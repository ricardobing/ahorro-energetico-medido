import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INES_RECEIPT_HISTORY_2025 } from '@ppam/fixtures';
import {
  acceptAndCompleteBurletes,
  createTestContext,
  uploadSimulatedBills,
  type TestContext,
} from './support/context.js';
import { TINY_PNG } from './support/fakes.js';
import { plain } from './support/text.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx?.close();
});

const febAnexo = {
  serviceType: 'electricity',
  kwhConsumed: 1690,
  costPerKwh: 0.78,
  billingStartDate: '2026-02-01',
  billingEndDate: '2026-02-28',
  uploadedFiles: [] as string[],
};

function uploadPhoto(contentType = 'image/png', content: Buffer = TINY_PNG) {
  return ctx.ines.post('/uploads').attach('file', content, { filename: 'factura', contentType });
}

describe('Alta de factura con el contrato existente', () => {
  it('Factura de febrero del anexo', async () => {
    const photo = await ctx
      .as('nuevo')
      .post('/uploads')
      .attach('file', TINY_PNG, { filename: 'factura-febrero.png', contentType: 'image/png' })
      .expect(201);
    const res = await ctx
      .as('nuevo')
      .post('/user-bill')
      .send({ ...febAnexo, uploadedFiles: [photo.body.fileId], photoQuality: 'ok' })
      .expect(201);
    expect(res.body).toMatchObject({
      kwhConsumed: 1690,
      costPerKwh: 0.78,
      billingStartDate: '2026-02-01',
      billingEndDate: '2026-02-28',
      days: 28,
      totalCost: 1318.2,
      co2Equivalent: 338,
      currency: 'PEN',
    });
  });
});

describe('Sin superposición por servicio', () => {
  it('Superposición de luz', async () => {
    const res = await ctx.ines
      .post('/user-bill')
      .send({ ...febAnexo, billingStartDate: '2026-02-15', billingEndDate: '2026-03-14' })
      .expect(409);
    expect(res.body.error.code).toBe('BILL_PERIOD_OVERLAP');
    expect(res.body.error.details.conflict).toEqual({
      billingStartDate: '2026-02-01',
      billingEndDate: '2026-02-28',
    });
  });

  it('Luz y agua del mismo mes', async () => {
    const res = await ctx.ines
      .post('/user-bill')
      .send({
        serviceType: 'water',
        volumeM3: 32,
        costPerM3: 3.5,
        billingStartDate: '2026-02-01',
        billingEndDate: '2026-02-28',
      })
      .expect(201);
    expect(res.body.serviceType).toBe('water');
  });
});

describe('Validación de valores de factura', () => {
  it('Fechas invertidas', async () => {
    const res = await ctx
      .as('nuevo')
      .post('/user-bill')
      .send({ ...febAnexo, billingStartDate: '2026-03-31', billingEndDate: '2026-03-01' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('La fecha de inicio tiene que ser anterior a la de cierre.');
  });

  it('Tarifa fuera de rango', async () => {
    const res = await ctx
      .as('nuevo')
      .post('/user-bill')
      .send({ ...febAnexo, costPerKwh: 78 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('0.20');
    expect(res.body.error.message).toContain('3.00');
  });

  it('rechaza un cuerpo que no respeta el contrato', async () => {
    const res = await ctx.as('nuevo').post('/user-bill').send({ kwhConsumed: 'mucho' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Confirmación de valores atípicos', () => {
  it('Un cero de más', async () => {
    ctx.fakes.clock.set('2026-08-05');
    const july = {
      ...febAnexo,
      kwhConsumed: 17_900,
      costPerKwh: 0.84,
      billingStartDate: '2026-07-01',
      billingEndDate: '2026-07-31',
    };
    const res = await ctx.ines.post('/user-bill').send(july).expect(422);
    expect(res.body.error).toMatchObject({
      code: 'BILL_NEEDS_CONFIRMATION',
      message: 'Es mucho más que tu consumo habitual. ¿Está bien el número?',
    });
    const confirmed = await ctx.ines
      .post('/user-bill')
      .send({ ...july, confirmAtypical: true })
      .expect(201);
    expect(confirmed.body.atypicalConfirmed).toBe(true);
  });
});

describe('Moneda por país', () => {
  it('Moneda de Inés', async () => {
    const list = await ctx.ines.get('/user-bill').expect(200);
    expect(list.body.items).toHaveLength(6);
    for (const bill of list.body.items) expect(bill.currency).toBe('PEN');
    expect(plain(list.body.items[0].totalCostText)).toMatch(/^S\/ /);
  });
});

describe('Edición y borrado con historial', () => {
  it('Editar', async () => {
    const res = await ctx.ines.patch('/user-bill/bill_ines_2026_03').send({ kwhConsumed: 1810 }).expect(200);
    expect(res.body).toMatchObject({ id: 'bill_ines_2026_03', kwhConsumed: 1810, version: 2 });
    const versions = await ctx.as('equipo').get('/audit/bills/bill_ines_2026_03/versions').expect(200);
    expect(versions.body.items).toEqual([expect.objectContaining({ version: 1, kwhConsumed: 1910 })]);
  });

  it('Borrar', async () => {
    await ctx.ines.delete('/user-bill/bill_ines_2026_05').expect(204);
    const list = await ctx.ines.get('/user-bill').expect(200);
    expect(list.body.items.map((b: { id: string }) => b.id)).not.toContain('bill_ines_2026_05');
    const versions = await ctx.as('equipo').get('/audit/bills/bill_ines_2026_05/versions').expect(200);
    expect(versions.body.deletedAt).toEqual(expect.any(String));
  });
});

describe('Origen y evidencia de cada factura', () => {
  it('Factura con foto correcta', async () => {
    const ids = await uploadSimulatedBills(ctx, ['ago']);
    const bill = await ctx.ines.get(`/user-bill/${ids['ago']}`).expect(200);
    expect(bill.body).toMatchObject({ evidence: 'photo_ok', source: 'user' });
  });

  it('Factura sin foto', async () => {
    ctx.fakes.clock.set('2026-08-05');
    const res = await ctx.ines
      .post('/user-bill')
      .send({
        ...febAnexo,
        costPerKwh: 0.84,
        billingStartDate: '2026-07-01',
        billingEndDate: '2026-07-31',
        kwhConsumed: 1790,
      })
      .expect(201);
    expect(res.body.evidence).toBe('no_photo');
  });
});

describe('Revisión de calidad de la foto en el dispositivo', () => {
  it('Reemplazar la foto después', async () => {
    const planId = await acceptAndCompleteBurletes(ctx);
    await uploadSimulatedBills(ctx, ['jul', 'ago']);
    const dark = await uploadPhoto();
    const sep = await ctx.ines
      .post('/user-bill')
      .send({
        ...febAnexo,
        kwhConsumed: 1600,
        costPerKwh: 0.84,
        billingStartDate: '2026-09-01',
        billingEndDate: '2026-09-30',
        uploadedFiles: [dark.body.fileId],
        photoQuality: 'retake',
      })
      .expect(201);
    expect(sep.body.evidence).toBe('photo_retake');
    const before = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);

    const good = await uploadPhoto();
    const updated = await ctx.ines
      .patch(`/user-bill/${sep.body.id}`)
      .send({ uploadedFiles: [good.body.fileId], photoQuality: 'ok' })
      .expect(200);
    expect(updated.body).toMatchObject({ evidence: 'photo_ok', kwhConsumed: 1600 });
    const after = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    expect(after.body.version).toBe(before.body.version);
  });
});

describe('Historial de consumo del recibo', () => {
  it('Historial cargado (sintético)', async () => {
    const planId = await acceptAndCompleteBurletes(ctx);
    await uploadSimulatedBills(ctx, ['jul', 'ago', 'sep']);
    await ctx.ines
      .put('/consumption-history')
      .send({ serviceType: 'electricity', months: INES_RECEIPT_HISTORY_2025.months })
      .expect(200);
    const bills = await ctx.ines.get('/user-bill').expect(200);
    expect(bills.body.items.map((b: { billingStartDate: string }) => b.billingStartDate)).not.toContain(
      '2025-07-01',
    );
    const savings = await ctx.ines.get(`/user-eco-card/${planId}/savings`).expect(200);
    expect(savings.body.method).toBe('YEAR_OVER_YEAR');
    expect(savings.body.labels).toContain('ESTIMATED_HISTORY');
    expect(plain(savings.body.display.methodLine)).toBe(
      'Comparado con los mismos meses del año pasado (datos aproximados del gráfico de tu recibo). Todavía no podemos descontar si tu negocio creció.',
    );
  });

  it('rechaza más de 12 meses de historial', async () => {
    const months = Array.from({ length: 13 }, (_, i) => ({
      month: `2025-${String((i % 12) + 1).padStart(2, '0')}`,
      kwh: 1700,
    }));
    await ctx.ines.put('/consumption-history').send({ serviceType: 'electricity', months }).expect(400);
  });
});

describe('Límites de las fotos de factura', () => {
  it('Archivo no permitido', async () => {
    const res = await uploadPhoto('application/pdf', Buffer.from('%PDF-1.4'));
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('Tercera foto', async () => {
    const files = [];
    for (let i = 0; i < 3; i++) files.push((await uploadPhoto().expect(201)).body.fileId as string);
    const res = await ctx
      .as('nuevo')
      .post('/user-bill')
      .send({ ...febAnexo, uploadedFiles: files, photoQuality: 'ok' })
      .expect(400);
    expect(res.body.error.code).toBe('TOO_MANY_FILES');
  });

  it('rechaza fotos de más de 5 MB', async () => {
    const res = await uploadPhoto('image/jpeg', Buffer.alloc(5 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });
});
