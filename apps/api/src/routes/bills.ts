import { Router } from 'express';
import type { ClientSession } from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import {
  BILL_PARAMS,
  billTotalCents,
  co2EquivalentKg,
  compareDates,
  currencyForCountry,
  daysInclusive,
  findOverlap,
  formatDateLong,
  formatMoney,
  isAtypical,
  kwhTimesTariffCents,
  localeForCountry,
  normalizeBill,
  validateBillInput,
  type Country,
  type Currency,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { ApiError, notFound, validationError } from '../errors.js';
import { requireOwner, requireStaff } from '../http/auth.js';
import { loadBusiness, models, newId, nowIso, type BillRecord, type PlanRecord } from '../core/common.js';
import { recomputeBusiness, type RecalcCause } from '../core/measurements.js';
import { trackFunnel } from '../core/notifications.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z.string().regex(ISO_DATE, 'La fecha tiene que tener el formato AAAA-MM-DD.');
const files = z.array(z.string().min(1).max(120)).max(20);

const electricityBody = z.object({
  serviceType: z.literal('electricity').optional(),
  kwhConsumed: z.number().finite(),
  costPerKwh: z.number().finite(),
  billingStartDate: isoDate,
  billingEndDate: isoDate,
  uploadedFiles: files.optional(),
  photoQuality: z.enum(['ok', 'retake']).optional(),
  confirmAtypical: z.boolean().optional(),
});

const waterBody = z.object({
  serviceType: z.literal('water'),
  volumeM3: z.number().finite(),
  costPerM3: z.number().finite(),
  billingStartDate: isoDate,
  billingEndDate: isoDate,
  uploadedFiles: files.optional(),
  photoQuality: z.enum(['ok', 'retake']).optional(),
});

const patchBody = z.object({
  kwhConsumed: z.number().finite().optional(),
  costPerKwh: z.number().finite().optional(),
  volumeM3: z.number().finite().optional(),
  costPerM3: z.number().finite().optional(),
  billingStartDate: isoDate.optional(),
  billingEndDate: isoDate.optional(),
  uploadedFiles: files.optional(),
  photoQuality: z.enum(['ok', 'retake']).optional(),
  confirmAtypical: z.boolean().optional(),
});

const historyBody = z.object({
  serviceType: z.literal('electricity'),
  months: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El mes tiene que tener el formato AAAA-MM.'),
        kwh: z.number().finite().positive().max(BILL_PARAMS.maxKwh),
      }),
    )
    .min(1)
    .max(12, 'El gráfico del recibo muestra 12 meses como máximo.'),
});

type BillFields = {
  serviceType: 'electricity' | 'water';
  kwhConsumed?: number;
  costPerKwh?: number;
  volumeM3?: number;
  costPerM3?: number;
  billingStartDate: string;
  billingEndDate: string;
};

/** Validación de valores con los mensajes del dominio. El agua usa sus propios límites. */
function validateValues(fields: BillFields, country: Country, today: string): void {
  if (fields.serviceType === 'electricity') {
    const errors = validateBillInput(
      {
        serviceType: 'electricity',
        kwhConsumed: fields.kwhConsumed ?? Number.NaN,
        costPerKwh: fields.costPerKwh ?? Number.NaN,
        billingStartDate: fields.billingStartDate,
        billingEndDate: fields.billingEndDate,
      },
      { country, today },
    );
    if (errors.length > 0) throw validationError(errors[0]!.message, { errors });
    return;
  }
  // Agua: mismas reglas de fechas; volumen positivo y precio por m³ razonable.
  const dateErrors = validateBillInput(
    {
      serviceType: 'water',
      kwhConsumed: 1,
      costPerKwh: 1,
      billingStartDate: fields.billingStartDate,
      billingEndDate: fields.billingEndDate,
    },
    { country, today },
  );
  if (dateErrors.length > 0) throw validationError(dateErrors[0]!.message, { errors: dateErrors });
  if (!fields.volumeM3 || fields.volumeM3 <= 0 || fields.volumeM3 > 100_000)
    throw validationError('El consumo de agua tiene que ser mayor que cero.');
  if (!fields.costPerM3 || fields.costPerM3 <= 0 || fields.costPerM3 > 100)
    throw validationError('El precio por m³ tiene que ser mayor que cero. Lo encuentras en tu recibo.');
}

const evidenceOf = (uploaded: string[], quality: 'ok' | 'retake' | undefined) =>
  uploaded.length === 0 ? 'no_photo' : quality === 'retake' ? 'photo_retake' : 'photo_ok';

function totals(fields: BillFields, country: Country) {
  if (fields.serviceType === 'electricity')
    return {
      totalCostCents: billTotalCents(fields.kwhConsumed!, fields.costPerKwh!),
      co2Equivalent: co2EquivalentKg(fields.kwhConsumed!, country),
    };
  return { totalCostCents: kwhTimesTariffCents(fields.volumeM3!, fields.costPerM3!), co2Equivalent: 0 };
}

export function billView(b: BillRecord, country: Country) {
  const locale = localeForCountry(country);
  return {
    id: b._id,
    serviceType: b.serviceType,
    ...(b.serviceType === 'electricity'
      ? { kwhConsumed: b.kwhConsumed, costPerKwh: b.costPerKwh }
      : { volumeM3: b.volumeM3, costPerM3: b.costPerM3 }),
    billingStartDate: b.billingStartDate,
    billingEndDate: b.billingEndDate,
    days: daysInclusive(b.billingStartDate, b.billingEndDate),
    totalCost: b.totalCostCents / 100,
    totalCostText: formatMoney(b.totalCostCents, b.currency as Currency, locale),
    co2Equivalent: b.co2Equivalent,
    currency: b.currency,
    evidence: b.evidence,
    uploadedFiles: b.uploadedFiles ?? [],
    source: b.source,
    atypicalConfirmed: b.atypicalConfirmed ?? false,
    version: b.version,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt ?? b.createdAt,
    dataSource: b.dataSource ?? null,
  };
}

async function checkFiles(deps: AppDeps, businessId: string, uploaded: string[]): Promise<void> {
  if (uploaded.length > BILL_PARAMS.maxPhotos)
    throw new ApiError(
      400,
      'TOO_MANY_FILES',
      `Puedes subir hasta ${BILL_PARAMS.maxPhotos} fotos por factura.`,
    );
  if (uploaded.length === 0) return;
  const found = await models(deps).Upload.countDocuments({ _id: { $in: uploaded }, businessId });
  if (found !== new Set(uploaded).size)
    throw new ApiError(400, 'FILE_NOT_FOUND', 'No encontramos una de las fotos. Súbela de nuevo.');
}

function overlapError(conflict: BillRecord, country: Country): ApiError {
  const locale = localeForCountry(country);
  const service = conflict.serviceType === 'electricity' ? 'luz' : 'agua';
  return new ApiError(
    409,
    'BILL_PERIOD_OVERLAP',
    `Ya tienes una factura de ${service} que cubre parte de esas fechas (del ${formatDateLong(conflict.billingStartDate, locale)} al ${formatDateLong(conflict.billingEndDate, locale)}). Revisa las fechas o corrige esa factura.`,
    { conflict: { billingStartDate: conflict.billingStartDate, billingEndDate: conflict.billingEndDate } },
  );
}

/**
 * Chequeo de superposición, de atípicos y escritura dentro de una transacción (D10). El documento de
 * bloqueo por negocio y servicio hace que dos altas simultáneas choquen y la segunda vea la primera.
 */
async function writeBill(
  deps: AppDeps,
  businessId: string,
  country: Country,
  fields: BillFields,
  opts: { billId?: string; confirmAtypical: boolean; checkAtypical: boolean },
  write: (session: ClientSession, atypical: boolean) => Promise<void>,
): Promise<void> {
  const m = models(deps);
  await deps.connection.transaction(async (session) => {
    await m.BillLock.updateOne(
      { _id: `${businessId}:${fields.serviceType}` },
      { $inc: { seq: 1 } },
      { upsert: true, session },
    );
    const existing = await m.Bill.find({ businessId, serviceType: fields.serviceType, deletedAt: null })
      .session(session)
      .lean<BillRecord[]>();
    const others = existing.map((b) => ({ ...b, id: b._id }));
    const conflict = findOverlap({ id: opts.billId, ...fields }, others);
    if (conflict) throw overlapError(conflict, country);

    let atypical = false;
    if (fields.serviceType === 'electricity' && opts.checkAtypical) {
      const previous = existing
        .filter((b) => b._id !== opts.billId && b.kwhConsumed)
        .map(
          (b) =>
            normalizeBill({
              ...b,
              id: b._id,
              kwhConsumed: b.kwhConsumed!,
              costPerKwh: b.costPerKwh ?? 0,
              serviceType: 'electricity',
            }).kwhPerDay,
        );
      const perDay = fields.kwhConsumed! / daysInclusive(fields.billingStartDate, fields.billingEndDate);
      atypical = isAtypical(perDay, previous);
      if (atypical && !opts.confirmAtypical) {
        const median = [...previous].sort((a, b) => a - b)[Math.floor(previous.length / 2)] ?? perDay;
        throw new ApiError(
          422,
          'BILL_NEEDS_CONFIRMATION',
          perDay > median
            ? 'Es mucho más que tu consumo habitual. ¿Está bien el número?'
            : 'Es mucho menos que tu consumo habitual. ¿Está bien el número?',
        );
      }
    }
    await write(session, atypical);
  });
}

async function afterBillChange(
  deps: AppDeps,
  businessId: string,
  bill: { serviceType: string; billingStartDate: string; billingEndDate: string },
  cause: RecalcCause,
) {
  if (bill.serviceType !== 'electricity') return;
  const m = models(deps);
  await recomputeBusiness(deps, businessId, cause);
  if (cause.kind === 'bill_created') {
    // El recordatorio de ese periodo ya no hace falta.
    await m.Outbox.updateMany(
      {
        businessId,
        template: 'bill_reminder',
        status: 'pending',
        ref: { $gte: bill.billingStartDate, $lte: bill.billingEndDate },
      },
      { $set: { status: 'cancelled' } },
    );
    const plans = await m.Plan.find({ businessId, implementedAt: { $ne: null } }).lean<PlanRecord[]>();
    const after = plans.find((p) => compareDates(bill.billingStartDate, p.implementedAt!) > 0);
    if (after)
      await trackFunnel(deps, {
        type: 'after_bill_uploaded',
        businessId,
        planId: after._id,
        ecoId: after.ecoCardOrigin,
      });
  }
}

async function ownBill(deps: AppDeps, businessId: string, id: string): Promise<BillRecord> {
  const bill = await models(deps).Bill.findOne({ _id: id, businessId, deletedAt: null }).lean<BillRecord>();
  if (!bill) throw notFound('La factura');
  return bill;
}

async function saveVersion(deps: AppDeps, bill: BillRecord, session?: ClientSession) {
  const { _id, ...rest } = bill;
  await models(deps).BillVersion.create([{ ...rest, billId: _id, changedAt: nowIso(deps) }], { session });
}

const PHOTO_SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

export function billRoutes(deps: AppDeps): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: BILL_PARAMS.maxPhotoBytes, files: 1 },
  });

  router.post('/uploads', upload.single('file'), async (req, res) => {
    const user = requireOwner(req);
    const file = req.file;
    if (!file) throw validationError('Falta la foto: envíala en el campo «file».');
    const allowed = (BILL_PARAMS.allowedPhotoTypes as readonly string[]).includes(file.mimetype);
    if (!allowed || !PHOTO_SIGNATURES[file.mimetype]?.(file.buffer))
      throw new ApiError(415, 'FILE_TYPE_NOT_ALLOWED', 'La foto tiene que ser JPEG, PNG o WebP.');
    const { fileId } = await deps.services.storage.put(file.buffer, file.mimetype);
    await models(deps).Upload.create({
      _id: fileId,
      businessId: user.businessId,
      contentType: file.mimetype,
      size: file.size,
      createdAt: nowIso(deps),
    });
    res.status(201).json({ fileId, size: file.size, contentType: file.mimetype });
  });

  router.get('/user-bill', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    const bills = await models(deps)
      .Bill.find({ businessId: user.businessId, deletedAt: null })
      .sort({ billingStartDate: -1, serviceType: 1 })
      .lean<BillRecord[]>();
    res.json({ items: bills.map((b) => billView(b, business.country)) });
  });

  router.get('/user-bill/:id', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    res.json(billView(await ownBill(deps, user.businessId, req.params.id as string), business.country));
  });

  router.post('/user-bill', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    const raw = (req.body ?? {}) as { serviceType?: unknown };
    const parsed = raw.serviceType === 'water' ? waterBody.parse(raw) : electricityBody.parse(raw);
    const fields: BillFields = { ...parsed, serviceType: parsed.serviceType ?? 'electricity' };
    validateValues(fields, business.country, deps.clock.today());
    const uploaded = parsed.uploadedFiles ?? [];
    await checkFiles(deps, user.businessId, uploaded);

    const id = newId('bill');
    const now = nowIso(deps);
    const confirmAtypical = 'confirmAtypical' in parsed && parsed.confirmAtypical === true;
    await writeBill(
      deps,
      user.businessId,
      business.country,
      fields,
      { confirmAtypical, checkAtypical: true },
      async (session, atypical) => {
        await models(deps).Bill.create(
          [
            {
              _id: id,
              businessId: user.businessId,
              ...fields,
              currency: currencyForCountry(business.country),
              ...totals(fields, business.country),
              evidence: evidenceOf(uploaded, parsed.photoQuality),
              uploadedFiles: uploaded,
              source: 'user',
              atypicalConfirmed: atypical && confirmAtypical,
              version: 1,
              deletedAt: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
          { session },
        );
      },
    );
    await afterBillChange(deps, user.businessId, fields, { kind: 'bill_created' });
    res.status(201).json(billView(await ownBill(deps, user.businessId, id), business.country));
  });

  router.patch('/user-bill/:id', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    const bill = await ownBill(deps, user.businessId, req.params.id as string);
    const changes = patchBody.parse(req.body ?? {});
    const fields: BillFields = {
      serviceType: bill.serviceType,
      kwhConsumed: changes.kwhConsumed ?? bill.kwhConsumed ?? undefined,
      costPerKwh: changes.costPerKwh ?? bill.costPerKwh ?? undefined,
      volumeM3: changes.volumeM3 ?? bill.volumeM3 ?? undefined,
      costPerM3: changes.costPerM3 ?? bill.costPerM3 ?? undefined,
      billingStartDate: changes.billingStartDate ?? bill.billingStartDate,
      billingEndDate: changes.billingEndDate ?? bill.billingEndDate,
    };
    validateValues(fields, business.country, deps.clock.today());
    const uploaded = changes.uploadedFiles ?? bill.uploadedFiles ?? [];
    if (changes.uploadedFiles) await checkFiles(deps, user.businessId, uploaded);
    const consumptionChanged =
      fields.kwhConsumed !== bill.kwhConsumed ||
      fields.billingStartDate !== bill.billingStartDate ||
      fields.billingEndDate !== bill.billingEndDate;

    await writeBill(
      deps,
      user.businessId,
      business.country,
      fields,
      {
        billId: bill._id,
        confirmAtypical: changes.confirmAtypical === true,
        checkAtypical: consumptionChanged,
      },
      async (session, atypical) => {
        await saveVersion(deps, bill, session);
        await models(deps).Bill.updateOne(
          { _id: bill._id },
          {
            $set: {
              ...fields,
              ...totals(fields, business.country),
              uploadedFiles: uploaded,
              evidence: changes.uploadedFiles
                ? evidenceOf(uploaded, changes.photoQuality)
                : changes.photoQuality
                  ? evidenceOf(uploaded, changes.photoQuality)
                  : bill.evidence,
              atypicalConfirmed: consumptionChanged
                ? atypical && changes.confirmAtypical === true
                : bill.atypicalConfirmed,
              version: bill.version + 1,
              updatedAt: nowIso(deps),
            },
          },
          { session },
        );
      },
    );
    if (consumptionChanged || fields.costPerKwh !== bill.costPerKwh)
      await afterBillChange(deps, user.businessId, fields, {
        kind: 'bill_corrected',
        billEnd: fields.billingEndDate,
      });
    res.json(billView(await ownBill(deps, user.businessId, bill._id), business.country));
  });

  router.delete('/user-bill/:id', async (req, res) => {
    const user = requireOwner(req);
    const bill = await ownBill(deps, user.businessId, req.params.id as string);
    await deps.connection.transaction(async (session) => {
      await saveVersion(deps, bill, session);
      await models(deps).Bill.updateOne(
        { _id: bill._id },
        { $set: { deletedAt: nowIso(deps), version: bill.version + 1 } },
        { session },
      );
    });
    await afterBillChange(deps, user.businessId, bill, {
      kind: 'bill_deleted',
      billEnd: bill.billingEndDate,
    });
    res.status(204).end();
  });

  router.put('/consumption-history', async (req, res) => {
    const user = requireOwner(req);
    const body = historyBody.parse(req.body ?? {});
    const months = [...new Map(body.months.map((m) => [m.month, m])).values()].sort((a, b) =>
      a.month < b.month ? -1 : 1,
    );
    const m = models(deps);
    await deps.connection.transaction(async (session) => {
      await m.History.deleteMany({ businessId: user.businessId, serviceType: 'electricity' }, { session });
      await m.History.insertMany(
        months.map((x) => ({ businessId: user.businessId, serviceType: 'electricity', ...x })),
        { session },
      );
    });
    await recomputeBusiness(deps, user.businessId, { kind: 'history' });
    res.json({ serviceType: 'electricity', months, estimated: true });
  });

  router.get('/consumption-history', async (req, res) => {
    const user = requireOwner(req);
    const months = await models(deps)
      .History.find({ businessId: user.businessId, serviceType: 'electricity' })
      .sort({ month: 1 })
      .lean<{ month: string; kwh: number }[]>();
    res.json({
      serviceType: 'electricity',
      months: months.map(({ month, kwh }) => ({ month, kwh })),
      estimated: true,
    });
  });

  router.get('/audit/bills/:id/versions', async (req, res) => {
    requireStaff(req);
    const m = models(deps);
    const bill = await m.Bill.findById(req.params.id).lean<BillRecord>();
    if (!bill) throw notFound('La factura');
    const versions = await m.BillVersion.find({ billId: bill._id }).sort({ version: 1 }).lean();
    res.json({
      billId: bill._id,
      currentVersion: bill.version,
      deletedAt: bill.deletedAt,
      items: versions.map(({ _id, ...v }) => v),
    });
  });

  return router;
}
