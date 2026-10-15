import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { processOutbox, scheduleBillReminders } from '../src/workers/index.js';
import {
  acceptAndCompleteBurletes,
  createTestContext,
  uploadSimulatedBills,
  type TestContext,
} from './support/context.js';

let ctx: TestContext;

/** Inés completó el primer paso y subió julio; la factura de agosto (cierre estimado 31/08) no llega. */
beforeEach(async () => {
  ctx = await createTestContext();
  await acceptAndCompleteBurletes(ctx);
  await uploadSimulatedBills(ctx, ['jul']);
  ctx.fakes.clock.set('2026-09-05');
});
afterEach(async () => {
  await ctx?.close();
});

const types = async () =>
  (await ctx.ines.get('/notifications').expect(200)).body.items.map(
    (n: { type: string }) => n.type,
  ) as string[];

describe('Recordatorio de factura por ciclo', () => {
  it('Factura de agosto que no llega', async () => {
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    const items = (await ctx.ines.get('/notifications').expect(200)).body.items;
    expect(items).toContainEqual(
      expect.objectContaining({ type: 'bill_reminder', title: 'Sube tu factura de agosto' }),
    );
    expect(ctx.fakes.messaging.sent).toHaveLength(1);
    expect(ctx.fakes.messaging.sent[0]).toMatchObject({
      email: 'ines@ejemplo.test',
      subject: 'Sube tu factura de agosto',
    });
  });

  it('no recuerda antes de los cinco días', async () => {
    ctx.fakes.clock.set('2026-09-04');
    await scheduleBillReminders(ctx.deps);
    expect(await types()).not.toContain('bill_reminder');
  });
});

describe('Avisos dentro de la app como canal principal', () => {
  it('Correo caído', async () => {
    ctx.fakes.messaging.defaultStatus = 503;
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    expect(await types()).toContain('bill_reminder');
    expect(ctx.fakes.messaging.sent).toHaveLength(0);
  });
});

describe('Correos con bandeja de salida y sin duplicados', () => {
  it('Error temporal', async () => {
    ctx.fakes.messaging.script = [500];
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    expect(ctx.fakes.messaging.sent).toHaveLength(0);
    ctx.fakes.clock.set('2026-09-06');
    await processOutbox(ctx.deps);
    await processOutbox(ctx.deps);
    expect(ctx.fakes.messaging.sent).toHaveLength(1);
    expect(ctx.fakes.messaging.attempts).toBe(2);
  });

  it('Recordatorios de meses distintos', async () => {
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    ctx.fakes.clock.set('2026-10-05');
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    expect(ctx.fakes.messaging.sent.map((m) => m.subject)).toEqual([
      'Sube tu factura de agosto',
      'Sube tu factura de septiembre',
    ]);
  });

  it('Mismo recordatorio dos veces', async () => {
    await scheduleBillReminders(ctx.deps);
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    await processOutbox(ctx.deps);
    expect(ctx.fakes.messaging.sent).toHaveLength(1);
    expect((await types()).filter((t) => t === 'bill_reminder')).toHaveLength(1);
  });

  it('Error permanente', async () => {
    ctx.fakes.messaging.script = [400];
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    ctx.fakes.clock.set('2026-09-10');
    await processOutbox(ctx.deps);
    expect(ctx.fakes.messaging.attempts).toBe(1);
    const outbox = await ctx.as('equipo').get('/audit/outbox?businessId=neg_ines').expect(200);
    expect(outbox.body.items[0]).toMatchObject({ status: 'failed', attempts: 1 });
    expect(await types()).toContain('bill_reminder');
  });
});

describe('Rebotes', () => {
  it('Correo rebotado', async () => {
    ctx.fakes.messaging.defaultStatus = 503;
    await scheduleBillReminders(ctx.deps);
    await processOutbox(ctx.deps);
    await ctx
      .as(null)
      .post('/webhooks/messaging/bounce')
      .set('x-api-key', ctx.deps.config.messaging.apiKey)
      .send({ email: 'ines@ejemplo.test' })
      .expect(204);
    const outbox = await ctx.as('equipo').get('/audit/outbox?businessId=neg_ines').expect(200);
    expect(outbox.body.items.every((i: { status: string }) => i.status === 'suppressed')).toBe(true);
    const items = (await ctx.ines.get('/notifications').expect(200)).body.items;
    expect(items).toContainEqual(
      expect.objectContaining({
        type: 'email_bounced',
        body: 'No pudimos escribirte a tu correo. Revisa que esté bien escrito.',
      }),
    );
  });

  it('el webhook de rebotes exige la clave del servicio', async () => {
    await ctx.as(null).post('/webhooks/messaging/bounce').send({ email: 'ines@ejemplo.test' }).expect(401);
  });
});
