import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PEER_STATS_CASE, PEER_TOTALS_CASE } from '@ppam/fixtures';
import { getModels } from '../src/db/models.js';
import { OpenAiProfileModel, PROFILE_SYSTEM_PROMPT } from '../src/services/profile-model.js';
import { recomputePeerStats } from '../src/workers/index.js';
import { acceptAndCompleteBurletes, createTestContext, type TestContext } from './support/context.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx?.close();
});

describe('MongoDB local en modo réplica', () => {
  it('una transacción confirma y otra se revierte', async () => {
    const { Setting } = getModels(ctx.connection);
    await ctx.connection.transaction(async (session) => {
      await Setting.create([{ _id: 'confirmada', value: 1 }], { session });
    });
    await expect(
      ctx.connection.transaction(async (session) => {
        await Setting.create([{ _id: 'revertida', value: 1 }], { session });
        throw new Error('falla a propósito');
      }),
    ).rejects.toThrow('falla a propósito');
    expect(await Setting.exists({ _id: 'confirmada' })).toBeTruthy();
    expect(await Setting.exists({ _id: 'revertida' })).toBeNull();
  });

  it('los índices únicos del diseño existen después de la carga', async () => {
    const m = getModels(ctx.connection);
    const unique = async (model: {
      collection: { indexes(): Promise<{ key: object; unique?: boolean }[]> };
    }) => (await model.collection.indexes()).filter((i) => i.unique).map((i) => Object.keys(i.key).join('+'));
    expect(await unique(m.BillVersion)).toContain('billId+version');
    expect(await unique(m.History)).toContain('businessId+serviceType+month');
    expect(await unique(m.Outbox)).toContain('idempotencyKey');
    expect(await unique(m.Measurement)).toContain('planId+version');
    expect(await unique(m.PeerStat)).toContain('version+sector+ecoId');
    expect(await unique(m.Recommendation)).toContain('businessId');
  });
});

describe('Sin superposición por servicio', () => {
  it('dos envíos simultáneos del mismo periodo: solo uno se guarda', async () => {
    ctx.fakes.clock.set('2026-08-05');
    const july = {
      serviceType: 'electricity',
      kwhConsumed: 1790,
      costPerKwh: 0.84,
      billingStartDate: '2026-07-01',
      billingEndDate: '2026-07-31',
    };
    const results = await Promise.all([
      ctx.ines.post('/user-bill').send(july),
      ctx.ines.post('/user-bill').send({ ...july, kwhConsumed: 1791 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const list = await ctx.ines.get('/user-bill').expect(200);
    expect(
      list.body.items.filter((b: { billingStartDate: string }) => b.billingStartDate === '2026-07-01'),
    ).toHaveLength(1);
  });
});

describe('adaptador de IA con el SDK de OpenAI', () => {
  it('pide JSON con el esquema estricto y las preferencias de proveedor de OpenRouter', async () => {
    const received: { url?: string; auth?: string; body?: Record<string, unknown> } = {};
    const server = createServer((req: IncomingMessage, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        received.url = req.url;
        received.auth = req.headers.authorization;
        received.body = JSON.parse(raw) as Record<string, unknown>;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            id: 'x',
            object: 'chat.completion',
            created: 0,
            model: 'm',
            choices: [
              {
                index: 0,
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content:
                    '{"ciiu":"1071","equipment":[],"ovenType":null,"budgetAmount":null,"hoursPerWeek":null}',
                },
              },
            ],
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      // La URL contiene «openrouter.ai» como ruta para activar las preferencias sin salir de la máquina.
      const model = new OpenAiProfileModel({
        baseURL: `http://127.0.0.1:${port}/openrouter.ai/api/v1`,
        apiKey: 'clave-de-prueba',
        model: 'deepseek/deepseek-v4.1-flash',
      });
      const raw = await model.suggest('Tengo una panadería', AbortSignal.timeout(2_000));
      expect(raw).toMatchObject({ ciiu: '1071' });
      expect(received.url).toBe('/openrouter.ai/api/v1/chat/completions');
      expect(received.auth).toBe('Bearer clave-de-prueba');
      expect(received.body).toMatchObject({
        model: 'deepseek/deepseek-v4.1-flash',
        response_format: { type: 'json_schema', json_schema: { name: 'perfil_asistido', strict: true } },
        provider: { require_parameters: true, data_collection: 'deny' },
      });
      const messages = received.body?.messages as { role: string; content: string }[];
      expect(messages[0]).toEqual({ role: 'system', content: PROFILE_SYSTEM_PROMPT });
      expect(messages[1]).toEqual({ role: 'user', content: 'Tengo una panadería' });
    } finally {
      server.close();
    }
  });

  it('si el modelo no responde a tiempo falla como timeout', async () => {
    const server = createServer(() => undefined);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const model = new OpenAiProfileModel({
        baseURL: `http://127.0.0.1:${port}/v1`,
        apiKey: 'k',
        model: 'm',
      });
      await expect(model.suggest('texto', AbortSignal.timeout(100))).rejects.toMatchObject({
        failure: 'timeout',
      });
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});

describe('datos de prueba y modo demostración', () => {
  it('las estadísticas calculadas desde la carga coinciden con la tabla del caso', async () => {
    const { version } = await recomputePeerStats(ctx.deps);
    const rows = await getModels(ctx.connection).PeerStat.find({ version, sector: '1071' }).lean();
    const byEco = Object.fromEntries(rows.map((r) => [r.ecoId, r]));
    for (const p of PEER_STATS_CASE)
      expect(byEco[p.ecoId]).toMatchObject({
        chose: p.chose,
        completed: p.completed,
        measuredCount: p.measuredCount,
        medianChangePct: p.medianChangePct,
      });
    const totals = rows.reduce(
      (acc, r) => ({
        chose: acc.chose + r.chose!,
        completed: acc.completed + r.completed!,
        measured: acc.measured + r.measuredCount!,
      }),
      { chose: 0, completed: 0, measured: 0 },
    );
    expect(totals).toEqual({
      chose: PEER_TOTALS_CASE.chose,
      completed: PEER_TOTALS_CASE.completed,
      measured: PEER_TOTALS_CASE.measured,
    });
  });

  it('simular el paso del tiempo lleva el resultado de «todavía no» a medido', async () => {
    const planId = await acceptAndCompleteBurletes(ctx);
    const status = async () => {
      const r = (await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200)).body;
      return [r.status, ...r.reasons] as string[];
    };
    await ctx.as(null).post('/demo/simulate-time').send({ through: 'jul' }).expect(200);
    expect(await status()).toEqual(['INSUFFICIENT_DATA', 'NO_AFTER_BILL']);
    await ctx.as(null).post('/demo/simulate-time').send({ through: 'ago' }).expect(200);
    expect(await status()).toEqual(['INSUFFICIENT_DATA', 'WITHIN_NOISE']);
    await ctx.as(null).post('/demo/simulate-time').expect(200);
    expect(await status()).toEqual(['MEASURED']);
  });

  it('sin modo demostración no existen las rutas de demostración', async () => {
    await ctx.close();
    ctx = await createTestContext({ config: { demoMode: false } });
    await ctx.as(null).post('/demo/reset').expect(404);
  });
});
