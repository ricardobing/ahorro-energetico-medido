import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMocksApp } from '../../mocks/src/app.js';
import { DemoClock, SystemClock } from '../src/clock.js';
import { DiskStorage, HttpCurrency, HttpMessaging, HttpSubtasks } from '../src/services/http.js';
import { TINY_PNG } from './support/fakes.js';

/** Los adaptadores HTTP de la API contra las simulaciones reales: los dos lados del mismo contrato del anexo. */
let server: Server;
let base: string;
const control = (body: Record<string, unknown>) =>
  fetch(`${base}/__control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  server = createMocksApp({ messagingApiKey: 'clave', bounceWebhookUrl: null }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
});
beforeEach(async () => {
  await fetch(`${base}/__control/reset`, { method: 'POST' });
});

describe('adaptadores HTTP contra las simulaciones', () => {
  it('mensajería: envía con la clave y clasifica las fallas', async () => {
    const messaging = new HttpMessaging(`${base}/messaging`, 'clave');
    await messaging.send({ email: 'ines@ejemplo.test', subject: 'Hola', html: '<p>Hola</p>' });
    const sent = (await (await fetch(`${base}/__control/messaging/sent`)).json()) as { items: unknown[] };
    expect(sent.items).toHaveLength(1);
    await control({ service: 'messaging', mode: 'error' });
    await expect(messaging.send({ email: 'a@b.test', subject: 's', html: 'h' })).rejects.toMatchObject({
      failure: 'unavailable',
      status: 500,
    });
    await control({ service: 'messaging', mode: 'reject' });
    await expect(messaging.send({ email: 'a@b.test', subject: 's', html: 'h' })).rejects.toMatchObject({
      failure: 'rejected',
    });
    await expect(
      new HttpMessaging(`${base}/messaging`, 'otra').send({ email: 'a@b.test', subject: 's', html: 'h' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('subtareas: ideas por paso, 402 sin cupo y timeout si tarda', async () => {
    const subtasks = new HttpSubtasks(`${base}/subtasks`);
    const ok = await subtasks.generate(
      { userEcoCardId: 'plan_1', stepsId: ['step_1'] },
      AbortSignal.timeout(2_000),
    );
    expect(ok.steps[0]?.subSteps.length).toBeGreaterThan(0);
    await control({ service: 'subtasks', mode: 'quota' });
    await expect(
      subtasks.generate({ userEcoCardId: 'plan_1', stepsId: ['step_1'] }, AbortSignal.timeout(2_000)),
    ).rejects.toMatchObject({ failure: 'quota', status: 402 });
    await control({ service: 'subtasks', mode: 'slow', delayMs: 500 });
    await expect(
      subtasks.generate({ userEcoCardId: 'plan_1', stepsId: ['step_1'] }, AbortSignal.timeout(100)),
    ).rejects.toMatchObject({ failure: 'timeout' });
  });

  it('moneda: tipo de cambio sintético y caída', async () => {
    const currency = new HttpCurrency(`${base}/currency`);
    expect(await currency.rate('PEN', 'USD', '2026-09-30')).toBeCloseTo(0.27, 6);
    await control({ service: 'currency', mode: 'down' });
    await expect(currency.rate('PEN', 'USD', '2026-09-30')).rejects.toMatchObject({ failure: 'unavailable' });
  });

  it('sin servicio del otro lado falla como no disponible', async () => {
    await expect(
      new HttpCurrency('http://127.0.0.1:9/currency').rate('PEN', 'USD', '2026-09-30'),
    ).rejects.toMatchObject({
      failure: 'unavailable',
    });
  });
});

describe('almacenamiento y relojes', () => {
  it('guarda y vuelve a leer una foto en disco', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ppam-'));
    try {
      const storage = new DiskStorage(dir);
      const { fileId } = await storage.put(TINY_PNG, 'image/png');
      expect(await storage.exists(fileId)).toBe(true);
      expect(await storage.read(fileId)).toEqual(TINY_PNG);
      expect(await storage.exists('file_no_existe')).toBe(false);
      expect(await storage.read('file_no_existe')).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('el reloj del sistema da la fecha de Lima y el de demostración avanza a pedido', () => {
    expect(new SystemClock().today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const demo = new DemoClock('2026-07-10');
    expect(demo.today()).toBe('2026-07-10');
    expect(demo.now().toISOString().slice(0, 10)).toBe('2026-07-10');
    demo.set('2026-10-05');
    expect(demo.today()).toBe('2026-10-05');
  });
});
