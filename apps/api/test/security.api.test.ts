import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createTestContext, type TestContext } from './support/context.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  if (ctx.connection.readyState !== 1)
    await ctx.connection.openUri(inject('mongoUri'), { dbName: ctx.connection.name });
  await ctx.close();
});

const feb = {
  serviceType: 'electricity',
  kwhConsumed: 1690,
  costPerKwh: 0.78,
  billingStartDate: '2026-02-01',
  billingEndDate: '2026-02-28',
};

describe('Cada negocio ve solo lo suyo', () => {
  it('Factura de otro negocio', async () => {
    const created = await ctx.as('nuevo').post('/user-bill').send(feb).expect(201);
    const id = created.body.id as string;
    for (const res of [
      await ctx.ines.get(`/user-bill/${id}`),
      await ctx.ines.patch(`/user-bill/${id}`).send({ kwhConsumed: 1 }),
      await ctx.ines.delete(`/user-bill/${id}`),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('el negocio sale de la sesión, no del cuerpo del pedido', async () => {
    const res = await ctx.ines.post('/user-bill').send({
      ...feb,
      billingStartDate: '2026-07-01',
      billingEndDate: '2026-07-01',
      businessId: 'neg_nuevo',
    });
    const nuevo = await ctx.as('nuevo').get('/user-bill').expect(200);
    expect(nuevo.body.items).toHaveLength(0);
    expect([400, 201]).toContain(res.status);
  });

  it('sin sesión responde 401', async () => {
    const res = await ctx.as(null).get('/first-step').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('Rol de aliado', () => {
  it('Aliado que pide una factura', async () => {
    const res = await ctx.as('aliado').get('/user-bill').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('Errores con formato uniforme', () => {
  it('Error inesperado', async () => {
    const res = await ctx.ines.get('/__test/error').expect(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Algo falló de nuestro lado. Intenta de nuevo en un rato.' },
      requestId: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/secreto|at\s+\S+\.ts|stack/i);
  });
});

describe('Base de datos no disponible', () => {
  it('Guardar una factura sin base de datos', async () => {
    await ctx.connection.close();
    const res = await ctx.ines
      .post('/user-bill')
      .send({ ...feb, billingStartDate: '2026-07-01', billingEndDate: '2026-07-05' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('configuración', () => {
  it('se niega a arrancar en producción con el modo demostración', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DEMO_MODE: 'true' })).toThrow(/DEMO_MODE/);
  });

  it('lee la configuración de IA de las variables de entorno', () => {
    const config = loadConfig({
      AI_PROFILE_ASSIST_ENABLED: 'true',
      AI_API_KEY: 'x',
      AI_MODEL_TEXT: 'deepseek/deepseek-v4.1-flash',
    });
    expect(config.profileAssist.enabled).toBe(true);
    expect(config.port).toBe(4100);
  });

  it('sin clave la IA queda apagada aunque la bandera diga que sí', () => {
    expect(loadConfig({ AI_PROFILE_ASSIST_ENABLED: 'true' }).profileAssist.enabled).toBe(false);
  });
});
