import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './support/context.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx?.close();
});

describe('Plan estancado y pausa', () => {
  it('Plan de Inés estancado', async () => {
    const plan = await ctx.ines.get('/user-eco-card/plan_552').expect(200);
    expect(plan.body).toMatchObject({
      id: 'plan_552',
      ecoCardOrigin: 'eco_071',
      status: 'in_progress',
      statusUpdatedAt: '2026-04-12',
      stalled: true,
    });
    const step = await ctx.ines.get('/first-step').expect(200);
    expect(step.body.stalledPlan).toMatchObject({
      id: 'plan_552',
      title: 'Aislamiento térmico del horno',
      daysWithoutChange: 89,
    });
  });

  it('Pausar y reanudar', async () => {
    const paused = await ctx.ines.patch('/user-eco-card/plan_552').send({ status: 'paused' }).expect(200);
    expect(paused.body.status).toBe('paused');
    expect(paused.body.steps).toEqual([
      { _id: 'step_1', title: 'Cotizar aislamiento', status: 'not_started', subSteps: [] },
    ]);
    expect(paused.body.events.map((e: { type: string }) => e.type)).toContain('paused');
    const resumed = await ctx.ines
      .patch('/user-eco-card/plan_552')
      .send({ status: 'in_progress' })
      .expect(200);
    expect(resumed.body.status).toBe('in_progress');
    expect(resumed.body.events.map((e: { type: string }) => e.type)).toContain('resumed');
  });
});

describe('Historial de eventos del plan', () => {
  it('Reabrir no borra la implementación', async () => {
    const accepted = await ctx.ines.post('/first-step/decision').send({ action: 'accept' }).expect(201);
    const id = accepted.body.plan.id as string;
    await ctx.ines
      .patch(`/user-eco-card/${id}`)
      .send({ status: 'completed', implementedAt: '2026-07-08' })
      .expect(200);
    const reopened = await ctx.ines.patch(`/user-eco-card/${id}`).send({ status: 'in_progress' }).expect(200);
    expect(reopened.body.status).toBe('in_progress');
    const completed = reopened.body.events.find((e: { type: string }) => e.type === 'completed');
    expect(completed.data.implementedAt).toBe('2026-07-08');
    expect(reopened.body.events.map((e: { type: string }) => e.type)).toContain('reopened');
  });
});

describe('Fecha de implementación al completar', () => {
  it('Completar sin fecha', async () => {
    const res = await ctx.ines.patch('/user-eco-card/plan_552').send({ status: 'completed' }).expect(422);
    expect(res.body.error.code).toBe('IMPLEMENTED_AT_REQUIRED');
    const plan = await ctx.ines.get('/user-eco-card/plan_552').expect(200);
    expect(plan.body.status).toBe('in_progress');
  });

  it('Fecha futura', async () => {
    const res = await ctx.ines
      .patch('/user-eco-card/plan_552')
      .send({ status: 'completed', implementedAt: '2026-07-20' })
      .expect(422);
    expect(res.body.error.code).toBe('IMPLEMENTED_AT_INVALID');
  });

  it('Completar con fecha', async () => {
    const accepted = await ctx.ines.post('/first-step/decision').send({ action: 'accept' }).expect(201);
    const res = await ctx.ines
      .patch(`/user-eco-card/${accepted.body.plan.id}`)
      .send({ status: 'completed', implementedAt: '2026-07-08' })
      .expect(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.implementedAt).toBe('2026-07-08');
    expect(res.body.measurementHint).toEqual({
      excludedMonth: '2026-07',
      firstMeasurableBillEta: '2026-08-31',
      message:
        'Tu factura de julio no cuenta porque incluye el día del cambio. El resultado se va a ver con la factura que cierra alrededor del 31 de agosto.',
    });
  });
});

describe('Subtareas con IA opcionales y sin bloqueo', () => {
  async function newPlan() {
    const accepted = await ctx.ines.post('/first-step/decision').send({ action: 'accept' }).expect(201);
    return accepted.body.plan as { id: string; steps: { _id: string }[] };
  }

  it('Sin cupo', async () => {
    const plan = await newPlan();
    ctx.fakes.subtasks.mode = 'quota';
    const res = await ctx.ines
      .post(`/user-eco-card/${plan.id}/steps/${plan.steps[0]!._id}/ideas`)
      .expect(402);
    expect(res.body.error).toMatchObject({
      code: 'AI_QUOTA_EXCEEDED',
      message: 'Se terminó el cupo gratis de ideas de este mes. Tus pasos siguen aquí.',
    });
    await ctx.ines
      .patch(`/user-eco-card/${plan.id}`)
      .send({ steps: [{ _id: plan.steps[0]!._id, status: 'completed' }] })
      .expect(200);
  });

  it('Servicio caído o lento', async () => {
    const plan = await newPlan();
    for (const mode of ['hang', 'error'] as const) {
      ctx.fakes.subtasks.mode = mode;
      const res = await ctx.ines
        .post(`/user-eco-card/${plan.id}/steps/${plan.steps[0]!._id}/ideas`)
        .expect(503);
      expect(res.body.error).toMatchObject({
        code: 'AI_UNAVAILABLE',
        message: 'Ahora no pudimos sugerir ideas extra. Tus pasos siguen aquí.',
      });
    }
  });

  it('Sin consumo automático', async () => {
    const plan = await newPlan();
    await ctx.ines.get(`/user-eco-card/${plan.id}`).expect(200);
    expect(ctx.fakes.subtasks.calls).toBe(0);
  });

  it('guarda las ideas recibidas en el paso', async () => {
    const plan = await newPlan();
    await ctx.ines.post(`/user-eco-card/${plan.id}/steps/${plan.steps[0]!._id}/ideas`).expect(200);
    const again = await ctx.ines.get(`/user-eco-card/${plan.id}`).expect(200);
    expect(again.body.steps[0].subSteps).toHaveLength(2);
  });
});
