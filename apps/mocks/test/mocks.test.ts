import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createMocksApp } from '../src/app.js';

const app = createMocksApp({ messagingApiKey: 'clave-de-prueba', bounceWebhookUrl: null });
const control = (body: Record<string, unknown>) => request(app).post('/__control').send(body).expect(204);

beforeEach(async () => {
  await request(app).post('/__control/reset').expect(204);
});

describe('mensajería simulada (contrato del anexo)', () => {
  const email = { email: 'ines@ejemplo.test', subject: 'Prueba', html: '<p>Hola</p>' };

  it('acepta un correo con la clave y responde 200', async () => {
    await request(app)
      .post('/messaging/v1/email/send')
      .set('x-api-key', 'clave-de-prueba')
      .send(email)
      .expect(200);
    const sent = await request(app).get('/__control/messaging/sent').expect(200);
    expect(sent.body.items).toEqual([email]);
  });

  it('sin la clave responde 401', async () => {
    await request(app).post('/messaging/v1/email/send').send(email).expect(401);
  });

  it('en modo falla responde 500 y en modo rechazo 400', async () => {
    await control({ service: 'messaging', mode: 'error' });
    await request(app)
      .post('/messaging/v1/email/send')
      .set('x-api-key', 'clave-de-prueba')
      .send(email)
      .expect(500);
    await control({ service: 'messaging', mode: 'reject' });
    await request(app)
      .post('/messaging/v1/email/send')
      .set('x-api-key', 'clave-de-prueba')
      .send(email)
      .expect(400);
  });
});

describe('subtareas con IA simuladas (contrato del anexo)', () => {
  const body = { userEcoCardId: 'plan_552', stepsId: ['step_1'] };

  it('devuelve subtareas por paso', async () => {
    const res = await request(app).post('/subtasks/ia/ecoinnovation/sub-tasks').send(body).expect(200);
    expect(res.body.steps).toEqual([
      { _id: 'step_1', subSteps: expect.arrayContaining([expect.any(String)]) },
    ]);
  });

  it('sin cupo responde 402', async () => {
    await control({ service: 'subtasks', mode: 'quota' });
    await request(app).post('/subtasks/ia/ecoinnovation/sub-tasks').send(body).expect(402);
  });

  it('en modo lento tarda lo indicado', async () => {
    await control({ service: 'subtasks', mode: 'slow', delayMs: 150 });
    const start = Date.now();
    await request(app).post('/subtasks/ia/ecoinnovation/sub-tasks').send(body).expect(200);
    expect(Date.now() - start).toBeGreaterThanOrEqual(140);
  });
});

describe('conversión de moneda simulada', () => {
  it('devuelve un tipo de cambio sintético', async () => {
    const res = await request(app).get('/currency/rate?from=PEN&to=USD&date=2026-09-30').expect(200);
    expect(res.body).toEqual({
      from: 'PEN',
      to: 'USD',
      date: '2026-09-30',
      rate: expect.any(Number),
      synthetic: true,
    });
  });

  it('caída responde 503', async () => {
    await control({ service: 'currency', mode: 'down' });
    await request(app).get('/currency/rate?from=PEN&to=USD&date=2026-09-30').expect(503);
  });
});

describe('panel de control', () => {
  it('rechaza servicios o modos desconocidos', async () => {
    await request(app).post('/__control').send({ service: 'banco', mode: 'error' }).expect(400);
  });
});
