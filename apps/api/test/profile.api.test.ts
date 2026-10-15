import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROFILE_DESCRIPTIONS } from '@ppam/fixtures';
import { createTestContext, type TestContext } from './support/context.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
  ctx.fakes.profileModel.response = {
    ciiu: '1071',
    equipment: ['electric_oven', 'refrigeration'],
    ovenType: 'electric',
    budgetAmount: 1200,
    hoursPerWeek: 4,
  };
});
afterEach(async () => {
  await ctx?.close();
});

const assist = (body: Record<string, unknown>) =>
  ctx.ines.post('/profile/assist').send({ description: PROFILE_DESCRIPTIONS.ines, ...body });

describe('Perfil asistido desde una descripción libre', () => {
  it('Descripción de Inés', async () => {
    const before = await ctx.ines.get('/profile').expect(200);
    const res = await assist({ noticeAccepted: true }).expect(200);
    expect(res.body.suggestions).toEqual({
      ciiu: { code: '1071', label: 'Elaboración de productos de panadería' },
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      budget: { amount: 1200, currency: 'PEN' },
      hoursPerWeek: 4,
      source: 'ai',
    });
    const after = await ctx.ines.get('/profile').expect(200);
    expect(after.body).toEqual(before.body);
  });

  it('Corrección antes de confirmar', async () => {
    await ctx.ines
      .patch('/profile')
      .send({ equipment: ['electric_oven'], ovenType: 'electric' })
      .expect(200);
    const profile = await ctx.ines.get('/profile').expect(200);
    expect(profile.body.equipment).toEqual(['electric_oven']);
    const step = await ctx.ines.get('/first-step').expect(200);
    expect(step.body.recommendation.ecoId).toBe('eco_204');
  });
});

describe('Perfil asistido con alternativa sin IA', () => {
  it('Modelo lento', async () => {
    ctx.fakes.profileModel.mode = 'hang';
    const res = await assist({ noticeAccepted: true }).expect(200);
    expect(res.body.suggestions.source).toBe('keywords');
    expect(res.body.suggestions.ciiu.code).toBe('1071');
  });

  it('con la IA desactivada usa palabras clave sin llamar al modelo', async () => {
    await ctx.close();
    ctx = await createTestContext({
      config: { profileAssist: { enabled: false, timeoutMs: 100, maxRequestsPerDay: 20 } },
    });
    const res = await assist({ noticeAccepted: true }).expect(200);
    expect(res.body.suggestions.source).toBe('keywords');
    expect(ctx.fakes.profileModel.calls).toHaveLength(0);
  });

  it('si el proveedor falla usa palabras clave', async () => {
    ctx.fakes.profileModel.mode = 'error';
    const res = await assist({ noticeAccepted: true }).expect(200);
    expect(res.body.suggestions.source).toBe('keywords');
  });
});

describe('Privacidad del perfil asistido', () => {
  it('Primer uso', async () => {
    const first = await assist({}).expect(409);
    expect(first.body.error).toMatchObject({
      code: 'AI_NOTICE_REQUIRED',
      message:
        'Tu descripción se envía a un servicio de IA solo para sugerir estos datos. No escribas nombres ni teléfonos.',
    });
    expect(ctx.fakes.profileModel.calls).toHaveLength(0);
    await assist({ noticeAccepted: true }).expect(200);
    await assist({}).expect(200);
  });

  it('Registros', async () => {
    await assist({ noticeAccepted: true }).expect(200);
    const logs = ctx.logLines.join('\n');
    expect(logs).not.toContain('dos refrigeradoras');
    expect(logs).not.toContain('1200 soles');
    const event = ctx.logLines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((l) => l['event'] === 'profile_assist');
    expect(event).toMatchObject({ model: 'modelo-de-prueba', outcome: 'ai', durationMs: expect.any(Number) });
  });
});

describe('Límite de uso del perfil asistido', () => {
  it('Límite superado', async () => {
    for (let i = 0; i < 20; i++) await assist({ noticeAccepted: true }).expect(200);
    const res = await assist({ noticeAccepted: true }).expect(200);
    expect(res.body.suggestions.source).toBe('keywords');
    expect(res.body.notice).toBe('Por hoy te sugerimos sin IA.');
    expect(ctx.fakes.profileModel.calls).toHaveLength(20);
  });
});
