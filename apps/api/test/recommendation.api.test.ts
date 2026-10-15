import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INES_BILLS_SIMULATED } from '@ppam/fixtures';
import { createTestContext, type TestContext } from './support/context.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx?.close();
});

describe('Recomendación vigente única y auditable', () => {
  it('Consulta repetida sin cambios', async () => {
    const first = await ctx.ines.get('/first-step').expect(200);
    const second = await ctx.ines.get('/first-step').expect(200);
    expect(first.body.recommendation.ecoId).toBe('eco_118');
    expect(second.body.recommendation.id).toBe(first.body.recommendation.id);
    expect(second.body.recommendation.createdAt).toBe(first.body.recommendation.createdAt);
  });

  it('Registro auditable', async () => {
    await ctx.ines.get('/first-step').expect(200);
    const audit = await ctx.as('equipo').get('/audit/businesses/neg_ines/recommendation').expect(200);
    const rec = audit.body.current;
    expect(rec.ecoId).toBe('eco_118');
    expect(rec.rulesetVersion).toBe('1.0.0');
    expect(rec.ranked.map((r: { ecoId: string }) => r.ecoId)).toEqual(['eco_118', 'eco_204', 'eco_033']);
    expect(rec.ranked[0].score).toBeCloseTo(2.08, 2);
    expect(rec.excluded.find((e: { ecoId: string }) => e.ecoId === 'eco_071').reasons).toEqual(
      expect.arrayContaining(['BUDGET_EXCEEDED', 'COMPLEXITY_ABOVE_LEVEL', 'PLAN_EXISTS']),
    );
    expect(rec.inputs).toMatchObject({
      budgetCents: 120_000,
      hoursPerWeek: 4,
      diagnosticLevel: 'Crecimiento',
      equipment: ['electric_oven', 'refrigeration'],
    });
    expect(rec.inputs.peerStatsVersion).toEqual(expect.any(String));
  });
});

describe('Una sola recomendación en todas las superficies', () => {
  it('Catálogo', async () => {
    const step = await ctx.ines.get('/first-step').expect(200);
    const catalog = await ctx.ines.get('/catalog').expect(200);
    expect(catalog.body.pinned.ecoId).toBe(step.body.recommendation.ecoId);
    expect(catalog.body.items.length).toBeGreaterThan(5);
  });

  it('Diagnóstico por etapas', async () => {
    const res = await ctx.ines.get('/diagnostic/recommendations').expect(200);
    expect(res.body.items.map((i: { ecoId: string }) => i.ecoId)).toEqual(['eco_118', 'eco_204', 'eco_033']);
  });

  it('Correo de bienvenida', async () => {
    const res = await ctx.ines.get('/welcome-email/preview').expect(200);
    expect(res.body.html).toContain('Mantenimiento de burletes y descongelamiento de refrigeradoras');
    expect(res.body.subject).toEqual(expect.any(String));
  });
});

describe('Recálculo solo ante cambios de entrada', () => {
  it('Cambio de presupuesto', async () => {
    const before = await ctx.ines.get('/first-step').expect(200);
    await ctx.ines.patch('/profile').send({ budgetQuarterCents: 30_000 }).expect(200);
    const after = await ctx.ines.get('/first-step').expect(200);
    expect(after.body.recommendation.id).not.toBe(before.body.recommendation.id);
    const audit = await ctx.as('equipo').get('/audit/businesses/neg_ines/recommendation').expect(200);
    expect(
      audit.body.history.find((r: { id: string }) => r.id === before.body.recommendation.id).status,
    ).toBe('superseded');
    // Con S/ 300, el LED (inversión MEDIA, desde S/ 500) queda afuera.
    expect(
      audit.body.current.excluded.find((e: { ecoId: string }) => e.ecoId === 'eco_033').reasons,
    ).toContain('BUDGET_EXCEEDED');
  });

  it('Sin cambios en el resultado', async () => {
    const before = await ctx.ines.get('/first-step').expect(200);
    ctx.fakes.clock.set('2026-08-05');
    const jul = INES_BILLS_SIMULATED[0]!;
    await ctx.ines
      .post('/user-bill')
      .send({
        serviceType: 'electricity',
        kwhConsumed: jul.kwhConsumed,
        costPerKwh: jul.costPerKwh,
        billingStartDate: jul.billingStartDate,
        billingEndDate: jul.billingEndDate,
      })
      .expect(201);
    const after = await ctx.ines.get('/first-step').expect(200);
    expect(after.body.recommendation.id).toBe(before.body.recommendation.id);
    const notifications = await ctx.ines.get('/notifications').expect(200);
    expect(notifications.body.items.map((n: { type: string }) => n.type)).not.toContain(
      'recommendation_changed',
    );
  });
});

describe('La usuaria decide', () => {
  it('Aceptar', async () => {
    const res = await ctx.ines.post('/first-step/decision').send({ action: 'accept' }).expect(201);
    expect(res.body.plan).toMatchObject({ ecoCardOrigin: 'eco_118', status: 'in_progress' });
    expect(res.body.plan.steps.map((s: { title: string }) => s.title)).toEqual([
      'Revisar burletes',
      'Programar descongelamiento',
      'Registrar consumo',
    ]);
    const audit = await ctx.as('equipo').get('/audit/businesses/neg_ines/recommendation').expect(200);
    expect(audit.body.current.decision).toMatchObject({ type: 'accepted', ecoId: 'eco_118' });
  });

  it('Elegir otra', async () => {
    const res = await ctx.ines
      .post('/first-step/decision')
      .send({ action: 'choose', ecoId: 'eco_204' })
      .expect(201);
    expect(res.body.plan.ecoCardOrigin).toBe('eco_204');
    const audit = await ctx.as('equipo').get('/audit/businesses/neg_ines/recommendation').expect(200);
    expect(audit.body.current.decision).toMatchObject({ type: 'chose_alternative', ecoId: 'eco_204' });
  });

  it('no se puede elegir una ecoinnovación excluida', async () => {
    const res = await ctx.ines
      .post('/first-step/decision')
      .send({ action: 'choose', ecoId: 'eco_090' })
      .expect(409);
    expect(res.body.error.code).toBe('NOT_ELIGIBLE');
  });

  it('¿Por qué esto?', async () => {
    const res = await ctx.ines.get('/first-step').expect(200);
    expect(res.body.explanation.reasons).toHaveLength(3);
    expect(res.body.why.peerCounts).toEqual({ chose: 9, completed: 7, measured: 4 });
    expect(res.body.why.factors).toMatchObject({
      pComplete: expect.closeTo(0.607, 3),
      detectable: true,
      budgetFit: 'FULL',
    });
    expect(res.body.why.dataUsed).toMatchObject({ budgetCents: 120_000, hoursPerWeek: 4 });
    expect(JSON.stringify(res.body)).not.toMatch(/pan_s\d|neg_nuevo|Panadería sintética/);
  });

  it('ofrece pausar el plan estancado', async () => {
    const res = await ctx.ines
      .post('/first-step/decision')
      .send({ action: 'accept', pausePlanId: 'plan_552' })
      .expect(201);
    expect(res.body.pausedPlan).toMatchObject({ id: 'plan_552', status: 'paused' });
  });
});
