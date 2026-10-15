import {
  compareDates,
  addDays,
  formatMonthName,
  localeForCountry,
  median,
  projectBillEnd,
  type Bill,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { ServiceError } from '../services/types.js';
import {
  loadElectricityBills,
  models,
  nowIso,
  type BusinessRecord,
  type PlanRecord,
} from '../core/common.js';
import { emailHtml, enqueueEmail, notify } from '../core/notifications.js';
import type { StoredMeasurement } from '../core/measurements.js';

/**
 * Tareas de fondo. En la app corren con un intervalo; en los tests se llaman directamente para que
 * el resultado no dependa del tiempo real.
 */

/** Días después del cierre estimado de una factura para recordarla. */
const REMINDER_GRACE_DAYS = 5;
/** Como mucho se recuerdan los últimos periodos que faltan, para no llenar los avisos tras una ausencia larga. */
const MAX_MISSING_PERIODS = 3;

/** Envía los correos pendientes cuya hora de reintento ya llegó. Devuelve cuántos procesó. */
export async function processOutbox(deps: AppDeps): Promise<{ processed: number }> {
  const m = models(deps);
  const now = deps.clock.now();
  let processed = 0;
  for (;;) {
    // Se reserva un envío por vez (pendiente → enviando), así dos workers nunca mandan el mismo correo.
    const item = await m.Outbox.findOneAndUpdate(
      { status: 'pending', nextAttemptAt: { $lte: now } },
      { $set: { status: 'sending' } },
      { sort: { nextAttemptAt: 1 }, new: true },
    ).lean();
    if (!item) break;
    processed++;
    const attempts = (item.attempts ?? 0) + 1;
    try {
      await deps.services.messaging.send({ email: item.to!, subject: item.subject!, html: item.html! });
      await m.Outbox.updateOne(
        { _id: item._id },
        { $set: { status: 'sent', attempts, sentAt: nowIso(deps), lastError: null } },
      );
    } catch (error) {
      const temporary =
        error instanceof ServiceError ? error.failure === 'unavailable' || error.failure === 'timeout' : true;
      const backoff = deps.config.outboxBackoffMs[attempts - 1];
      const retry = temporary && backoff !== undefined;
      await m.Outbox.updateOne(
        { _id: item._id },
        {
          $set: {
            status: retry ? 'pending' : 'failed',
            attempts,
            nextAttemptAt: retry ? new Date(now.getTime() + backoff) : item.nextAttemptAt,
            lastError: error instanceof Error ? error.message.slice(0, 200) : 'Error desconocido',
          },
        },
      );
    }
  }
  return { processed };
}

/** Periodos que ya deberían haber llegado (cierre estimado + 5 días) y no están cargados. */
function missingPeriods(bills: Bill[], today: string): string[] {
  const missing: string[] = [];
  let from = bills.reduce(
    (a, b) => (compareDates(b.billingEndDate, a) > 0 ? b.billingEndDate : a),
    '0000-01-01',
  );
  for (let i = 0; i < 24; i++) {
    const end = projectBillEnd(bills, from);
    if (!end || compareDates(addDays(end, REMINDER_GRACE_DAYS), today) > 0) break;
    missing.push(end);
    from = end;
  }
  return missing.slice(-MAX_MISSING_PERIODS);
}

/** Encola los recordatorios de factura que corresponden hoy (sin repetir periodo). */
export async function scheduleBillReminders(deps: AppDeps): Promise<{ scheduled: number }> {
  const m = models(deps);
  const today = deps.clock.today();
  const businessIds = await m.Plan.distinct('businessId', { implementedAt: { $ne: null } });
  let scheduled = 0;
  for (const businessId of businessIds as string[]) {
    const business = await m.Business.findById(businessId).lean<BusinessRecord>();
    if (!business) continue;
    const bills = await loadElectricityBills(deps, businessId);
    if (bills.length === 0) continue;
    const locale = localeForCountry(business.country);
    for (const periodEnd of missingPeriods(bills, today)) {
      const month = formatMonthName(periodEnd, locale);
      const title = `Sube tu factura de ${month}`;
      const body = `Tu factura de luz de ${month} ya debería haber llegado. Súbela para ver si bajó tu consumo.`;
      const created = await notify(deps, {
        businessId,
        type: 'bill_reminder',
        title,
        body,
        link: '/factura',
        dedupeKey: `bill_reminder:${businessId}:${periodEnd}`,
      });
      await enqueueEmail(deps, {
        businessId,
        template: 'bill_reminder',
        ref: periodEnd,
        subject: title,
        html: emailHtml(title, [body], { label: 'Subir mi factura', href: '/factura' }),
      });
      if (created) scheduled++;
    }
  }
  return { scheduled };
}

/**
 * Recalcula las estadísticas de pares por sector y ecoinnovación con los planes y mediciones de la base,
 * sin combinaciones (negocios con dos mediciones superpuestas), y deja la versión nueva como vigente.
 */
export async function recomputePeerStats(deps: AppDeps): Promise<{ version: string }> {
  const m = models(deps);
  const plans = await m.Plan.find().lean<PlanRecord[]>();
  const businesses = new Map((await m.Business.find().lean<BusinessRecord[]>()).map((b) => [b._id, b]));
  const measurements = await m.Measurement.find({ current: true }).lean<StoredMeasurement[]>();
  const byPlan = new Map(measurements.map((x) => [x.planId, x]));

  const measuredByBusiness = new Map<string, StoredMeasurement[]>();
  for (const x of measurements) {
    const measured = x.synthetic ? x.synthetic.category === 'measured' : x.status === 'MEASURED';
    if (!measured) continue;
    measuredByBusiness.set(x.businessId, [...(measuredByBusiness.get(x.businessId) ?? []), x]);
  }
  const combos = new Set(
    [...measuredByBusiness.entries()].filter(([, list]) => list.length > 1).map(([businessId]) => businessId),
  );

  const rows = new Map<
    string,
    { sector: string; ecoId: string; chose: number; completed: number; changes: number[] }
  >();
  for (const plan of plans) {
    const sector = businesses.get(plan.businessId)?.ciiu;
    if (!sector) continue;
    const key = `${sector}:${plan.ecoCardOrigin}`;
    const row = rows.get(key) ?? { sector, ecoId: plan.ecoCardOrigin, chose: 0, completed: 0, changes: [] };
    row.chose++;
    if (plan.status === 'completed') row.completed++;
    const x = byPlan.get(plan._id);
    const change = x?.synthetic
      ? x.synthetic.changePct
      : x?.status === 'MEASURED'
        ? x.result.changePct
        : null;
    const measured = x?.synthetic ? x.synthetic.category === 'measured' : x?.status === 'MEASURED';
    if (measured && change !== null && change !== undefined && !combos.has(plan.businessId))
      row.changes.push(change);
    rows.set(key, row);
  }

  const version = `computed-${deps.clock.today()}-${Date.now().toString(36)}`;
  await m.PeerStat.insertMany(
    [...rows.values()].map((r) => ({
      version,
      sector: r.sector,
      ecoId: r.ecoId,
      chose: r.chose,
      completed: r.completed,
      measuredCount: r.changes.length,
      medianChangePct: r.changes.length ? Math.round(median(r.changes) * 10) / 10 : null,
      source: 'computed',
      createdAt: nowIso(deps),
    })),
  );
  await m.Setting.updateOne({ _id: 'peerStatsVersion' }, { $set: { value: version } }, { upsert: true });
  return { version };
}
