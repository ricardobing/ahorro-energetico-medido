import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptAndCompleteBurletes,
  createTestContext,
  uploadSimulatedBills,
  type TestContext,
} from './support/context.js';
import { plain } from './support/text.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx?.close();
});

/** Nada del informe para aliados puede identificar a un negocio. */
const IDENTIFYING = /pan_s\d|neg_ines|neg_nuevo|Panadería|Inés|Huamán|Arequipa|Cusco|@ejemplo/;

describe('Reporte de ahorro para la usuaria', () => {
  it('Reporte con resultado medido (sintético)', async () => {
    await acceptAndCompleteBurletes(ctx);
    await uploadSimulatedBills(ctx, ['jul', 'ago', 'sep']);
    const res = await ctx.ines.get('/savings/report').expect(200);
    expect(res.body).toMatchObject({
      status: 'MEASURED',
      evidence: 'con comprobante',
      method: 'periodos cercanos, sin corrección por temporada',
      period: {
        baselineFrom: '2026-04-01',
        baselineTo: '2026-06-30',
        afterFrom: '2026-08-01',
        afterTo: '2026-09-30',
      },
      computedAt: expect.any(String),
    });
    expect(plain(res.body.changeText)).toBe('6 % menos de luz por día');
    expect(plain(res.body.moneyText)).toBe('Unos S/ 90 menos por mes (entre S/ 20 y S/ 160)');
  });

  it('Reporte sin resultado', async () => {
    const res = await ctx.ines.get('/savings/report').expect(200);
    expect(res.body.status).toBe('INSUFFICIENT_DATA');
    expect(res.body.title).toBe('Todavía no hay un ahorro medido');
    expect(res.body.moneyText).toBeNull();
    expect(res.body.changeText).toBeNull();
  });
});

describe('Informe para aliados solo con datos agregados', () => {
  it('Informe del trimestre (sintético)', async () => {
    const res = await ctx.as('aliado').get('/partners/report?period=2026-T3').expect(200);
    expect(res.body.period).toBe('2026-T3');
    expect(res.body.byStatus.measured).toBe(12);
    expect(Object.keys(res.body.byStatus).sort()).toEqual(['measured', 'noData', 'noSavings', 'notYet']);
    expect(JSON.stringify(res.body)).not.toMatch(IDENTIFYING);
  });

  it('las ecoinnovaciones con menos de 5 negocios medidos aparecen como «menos de 5 negocios»', async () => {
    const res = await ctx.as('aliado').get('/partners/report?period=2026-T3').expect(200);
    const rows = Object.fromEntries(res.body.byEco.map((r: { ecoId: string }) => [r.ecoId, r]));
    expect(rows['eco_033']).toMatchObject({ businesses: 5, medianChangePct: -4 });
    for (const eco of ['eco_118', 'eco_204', 'eco_071'])
      expect(rows[eco]).toMatchObject({ businesses: 'menos de 5', medianChangePct: null });
  });
});

describe('Medido separado de declarado', () => {
  it('Informe con ambos tipos de dato (sintético)', async () => {
    const res = await ctx.as('aliado').get('/partners/report?period=2026-T3').expect(200);
    expect(res.body.declared).toMatchObject({ label: 'declarado por las usuarias, no medido', forms: 5 });
    // Con 3 mediciones «declaradas» (sin comprobante), la celda se oculta y la de «con comprobante» también,
    // porque se podría deducir restando del total.
    expect(res.body.measured.evidence).toEqual({
      withReceipt: null,
      declared: null,
      hiddenNote: 'menos de 5 negocios',
    });
    expect(res.body.measured.method).toMatchObject({ RECENT_PERIODS: 12 });
  });
});

describe('Montos por moneda y equivalente en USD', () => {
  it('Conversión caída', async () => {
    ctx.fakes.currency.down = true;
    const res = await ctx.as('aliado').get('/partners/report?period=2026-T3').expect(200);
    expect(res.body.amounts.map((a: { currency: string }) => a.currency).sort()).toEqual(['BOB', 'PEN']);
    expect(res.body.usd).toBeNull();
    expect(res.body.usdNote).toBe('Equivalente en USD no disponible en este momento');
  });

  it('con conversión informa el equivalente en USD', async () => {
    const res = await ctx.as('aliado').get('/partners/report?period=2026-T3').expect(200);
    expect(res.body.usd).toEqual(expect.any(Number));
    expect(res.body.usdNote).toContain('tipo de cambio');
  });
});

describe('Cierre de periodo del informe', () => {
  it('Corrección después del cierre (sintético)', async () => {
    await acceptAndCompleteBurletes(ctx);
    const ids = await uploadSimulatedBills(ctx, ['jul', 'ago', 'sep']);
    const open = await ctx.as('aliado').get('/partners/report?period=2026-T3').expect(200);
    expect(open.body.byStatus.measured).toBe(13);

    await ctx.as('equipo').post('/partners/report/2026-T3/close').expect(200);
    await ctx.ines.patch(`/user-bill/${ids['sep']}`).send({ kwhConsumed: 1700 }).expect(200);

    const closed = await ctx.as('aliado').get('/partners/report?period=2026-T3').expect(200);
    expect(closed.body).toEqual({ ...open.body, status: 'closed', closedAt: expect.any(String) });
    const next = await ctx.as('aliado').get('/partners/report?period=2026-T4').expect(200);
    expect(next.body.adjustments).toEqual([expect.objectContaining({ period: '2026-T3' })]);
  });

  it('un aliado no puede cerrar un periodo', async () => {
    await ctx.as('aliado').post('/partners/report/2026-T3/close').expect(403);
  });
});

describe('Eventos para medir la meta', () => {
  it('Recorrido completo (sintético)', async () => {
    await ctx.ines.get('/first-step').expect(200);
    const planId = await acceptAndCompleteBurletes(ctx);
    await uploadSimulatedBills(ctx, ['jul', 'ago', 'sep']);
    await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    const res = await ctx.as('equipo').get('/audit/funnel-events?businessId=neg_ines').expect(200);
    const types = res.body.items.map((e: { type: string }) => e.type);
    for (const t of [
      'recommendation_shown',
      'recommendation_accepted',
      'plan_completed',
      'after_bill_uploaded',
      'measurement_result',
    ])
      expect(types).toContain(t);
    for (const e of res.body.items) expect(e.at).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/@ejemplo|Inés|Huamán/);
  });
});
