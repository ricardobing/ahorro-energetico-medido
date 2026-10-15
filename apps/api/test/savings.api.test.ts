import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptAndCompleteBurletes,
  createTestContext,
  uploadSimulatedBills,
  type TestContext,
} from './support/context.js';
import { plain } from './support/text.js';

let ctx: TestContext;
let planId: string;
let ids: Record<string, string>;

beforeEach(async () => {
  ctx = await createTestContext();
  planId = await acceptAndCompleteBurletes(ctx);
  ids = await uploadSimulatedBills(ctx, ['jul', 'ago', 'sep']);
});
afterEach(async () => {
  await ctx?.close();
});

describe('medición de punta a punta', () => {
  it('coincide con los escenarios del dominio con las facturas del caso y las sintéticas', async () => {
    const res = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    expect(res.body).toMatchObject({ status: 'MEASURED', method: 'RECENT_PERIODS', methodVersion: '1.0.0' });
    expect(res.body.changePct).toBeCloseTo(-6.21, 2);
    expect(res.body.savings.amountPerMonthCents).toBe(9211);
    expect(res.body.excluded).toContainEqual({ billId: ids['jul'], reason: 'CONTAINS_IMPLEMENTATION_DATE' });
    expect(plain(res.body.display.summary)).toBe(
      'Desde que cambiaste los burletes usas 6 % menos de luz por día. A la tarifa de hoy son unos S/ 90 menos por mes (entre S/ 20 y S/ 160).',
    );
    expect(res.body.inputsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('el plan de otro negocio no existe para Inés', async () => {
    await ctx.as('nuevo').get(`/user-eco-card/${planId}/savings`).expect(404);
  });
});

describe('Recálculo determinista y versionado', () => {
  it('Factura editada', async () => {
    const before = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    await ctx.ines.patch(`/user-bill/${ids['sep']}`).send({ kwhConsumed: 1620 }).expect(200);
    const after = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    expect(after.body.version).toBe(before.body.version + 1);
    expect(after.body.inputsHash).not.toBe(before.body.inputsHash);
    const audit = await ctx.as('equipo').get(`/audit/measurements/${planId}`).expect(200);
    // Cada factura subida ya generó su versión; las dos últimas son la anterior y la nueva.
    expect(audit.body.items.map((m: { version: number }) => m.version).slice(-2)).toEqual([
      before.body.version,
      after.body.version,
    ]);
  });

  it('recalcular con los mismos datos no crea una versión nueva', async () => {
    const a = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    const b = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    expect(b.body.version).toBe(a.body.version);
    expect(b.body.inputsHash).toBe(a.body.inputsHash);
  });
});

describe('Cada día cuenta una vez', () => {
  it('Borrar una factura posterior (sintético)', async () => {
    await ctx.ines.delete(`/user-bill/${ids['sep']}`).expect(204);
    const res = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    expect(res.body.status).toBe('INSUFFICIENT_DATA');
    expect(res.body.reasons).toEqual(['WITHIN_NOISE']);
  });
});

describe('Aviso de recálculo y una sola cifra vigente', () => {
  it('Corrección de una factura', async () => {
    await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    // 1641 kWh en septiembre: el ahorro pasa de unos S/ 92 a unos S/ 75 por mes.
    await ctx.ines.patch(`/user-bill/${ids['sep']}`).send({ kwhConsumed: 1641 }).expect(200);
    const notifications = await ctx.ines.get('/notifications').expect(200);
    expect(notifications.body.items.map((n: { body: string }) => plain(n.body))).toContain(
      'Recalculamos tu ahorro porque corregiste tu factura de septiembre: antes unos S/ 90, ahora unos S/ 75.',
    );
    const savings = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    expect(plain(savings.body.display.money.text)).toBe('Unos S/ 75 menos por mes');
  });

  it('no avisa si la medición nunca se mostró', async () => {
    await ctx.ines.patch(`/user-bill/${ids['sep']}`).send({ kwhConsumed: 1641 }).expect(200);
    const notifications = await ctx.ines.get('/notifications').expect(200);
    expect(notifications.body.items.map((n: { type: string }) => n.type)).not.toContain(
      'savings_recalculated',
    );
  });
});
