import {
  buildSavingsDisplay,
  formatMonthName,
  localeForCountry,
  measureSavings,
  METHOD_VERSION,
  type Bill,
  type HistoryMonth,
  type MeasurementResult,
  type SavingsDisplay,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import {
  loadBusiness,
  loadCatalog,
  loadElectricityBills,
  models,
  nowIso,
  sha256,
  type BusinessRecord,
  type PlanRecord,
} from './common.js';
import { notify, trackFunnel } from './notifications.js';

export interface StoredMeasurement {
  _id: unknown;
  planId: string;
  businessId: string;
  version: number;
  current: boolean;
  inputsHash: string;
  methodVersion: string;
  status: MeasurementResult['status'];
  result: MeasurementResult;
  periods: MeasurementPeriods | null;
  computedAt: string;
  shownAt: string | null;
  synthetic: SyntheticOutcome | null;
}

export interface MeasurementPeriods {
  baselineFrom: string | null;
  baselineTo: string | null;
  afterFrom: string | null;
  afterTo: string | null;
}

/** Resultado de una panadería sintética de la carga inicial (no tiene facturas cargadas). */
export interface SyntheticOutcome {
  category: 'measured' | 'notYet' | 'noSavings' | 'noData';
  ecoId: string;
  changePct: number | null;
  evidence: 'with_receipt' | 'declared' | null;
  method: 'RECENT_PERIODS' | 'YEAR_OVER_YEAR' | null;
  kwhPerMonth: number | null;
  amountPerMonthCents: number | null;
  currency: 'PEN' | 'BOB';
  measuredAt: string | null;
}

/** Por qué se recalculó, para el aviso «Recalculamos tu ahorro porque …». */
export type RecalcCause =
  | { kind: 'bill_created' }
  | { kind: 'bill_corrected'; billEnd: string }
  | { kind: 'bill_deleted'; billEnd: string }
  | { kind: 'history' }
  | { kind: 'plan' };

async function loadHistory(deps: AppDeps, businessId: string): Promise<HistoryMonth[]> {
  const rows = await models(deps)
    .History.find({ businessId, serviceType: 'electricity' })
    .sort({ month: 1 })
    .lean<HistoryMonth[]>();
  return rows.map(({ month, kwh }) => ({ month, kwh }));
}

function periodsOf(result: MeasurementResult, bills: Bill[]): MeasurementPeriods {
  const byId = new Map(bills.map((b) => [b.id, b]));
  const span = (ids: string[] | undefined) => {
    const used = (ids ?? []).map((id) => byId.get(id)).filter((b): b is Bill => b !== undefined);
    if (used.length === 0) return [null, null] as const;
    const starts = used.map((b) => b.billingStartDate).sort();
    const ends = used.map((b) => b.billingEndDate).sort();
    return [starts[0]!, ends.at(-1)!] as const;
  };
  const [baselineFrom, baselineTo] = span(result.baseline?.billIds);
  const [afterFrom, afterTo] = span(result.after?.billIds);
  return { baselineFrom, baselineTo, afterFrom, afterTo };
}

/** Frase en pasado para «Desde que …»: la del catálogo o, si no tiene, una genérica. */
export async function actionPhraseFor(deps: AppDeps, ecoId: string): Promise<string> {
  const eco = (await loadCatalog(deps)).find((e) => e.id === ecoId);
  return eco?.actionPhrase ?? `terminaste «${eco?.title ?? 'tu primer paso'}»`;
}

export function displayFor(
  result: MeasurementResult,
  business: BusinessRecord,
  actionPhrase: string,
): SavingsDisplay {
  return buildSavingsDisplay(result, { country: business.country, actionPhrase });
}

function causeText(cause: RecalcCause, business: BusinessRecord): string {
  const locale = localeForCountry(business.country);
  switch (cause.kind) {
    case 'bill_corrected':
      return `corregiste tu factura de ${formatMonthName(cause.billEnd, locale)}`;
    case 'bill_deleted':
      return `borraste tu factura de ${formatMonthName(cause.billEnd, locale)}`;
    case 'history':
      return 'cargaste el historial de tu recibo';
    case 'plan':
      return 'cambiaste la fecha en que terminaste tu primer paso';
    case 'bill_created':
      return 'subiste una factura nueva';
  }
}

/** «unos S/ 90» o, si ya no hay ahorro medido, cómo quedó. */
function shortAmount(display: SavingsDisplay): string {
  if (display.money) return display.money.text.replace(/^Unos /, 'unos ').replace(/ menos por mes$/, '');
  return display.headline.charAt(0).toLowerCase() + display.headline.slice(1);
}

/**
 * Recalcula la medición de un plan (función pura del dominio). Si la huella de las entradas no cambió,
 * no crea versión. Si cambió una cifra que la usuaria ya vio, deja un aviso (D9).
 */
export async function recomputePlan(
  deps: AppDeps,
  plan: PlanRecord,
  business: BusinessRecord,
  cause: RecalcCause | null,
): Promise<StoredMeasurement> {
  const m = models(deps);
  const [bills, history] = await Promise.all([
    loadElectricityBills(deps, plan.businessId),
    loadHistory(deps, plan.businessId),
  ]);
  const input = {
    bills,
    history,
    implementedAt: plan.implementedAt ?? null,
    country: business.country,
    ciiu: business.ciiu,
  };
  const inputsHash = sha256({
    methodVersion: METHOD_VERSION,
    ...input,
    bills: [...bills].sort((a, b) => (a.id < b.id ? -1 : 1)),
  });
  const current = await m.Measurement.findOne({ planId: plan._id, current: true }).lean<StoredMeasurement>();
  if (current && current.inputsHash === inputsHash) return current;

  const result = measureSavings(input);
  const next: Omit<StoredMeasurement, '_id'> = {
    planId: plan._id,
    businessId: plan.businessId,
    version: (current?.version ?? 0) + 1,
    current: true,
    inputsHash,
    methodVersion: result.methodVersion,
    status: result.status,
    result,
    periods: periodsOf(result, bills),
    computedAt: nowIso(deps),
    shownAt: null,
    synthetic: null,
  };
  if (current) await m.Measurement.updateOne({ _id: current._id }, { $set: { current: false } });
  const created = await m.Measurement.create(next);
  await trackFunnel(deps, {
    type: 'measurement_result',
    businessId: plan.businessId,
    planId: plan._id,
    ecoId: plan.ecoCardOrigin,
    data: { status: result.status, version: next.version },
  });

  if (current?.shownAt && cause) {
    const phrase = await actionPhraseFor(deps, plan.ecoCardOrigin);
    const before = displayFor(current.result, business, phrase);
    const after = displayFor(result, business, phrase);
    if (shortAmount(before) !== shortAmount(after) || before.status !== after.status)
      await notify(deps, {
        businessId: plan.businessId,
        type: 'savings_recalculated',
        title: 'Recalculamos tu ahorro',
        body: `Recalculamos tu ahorro porque ${causeText(cause, business)}: antes ${shortAmount(before)}, ahora ${shortAmount(after)}.`,
        link: '/ahorro',
      });
  }
  return { ...next, _id: created._id };
}

/** Recalcula todos los planes con fecha de implementación del negocio (después de cada cambio de entradas). */
export async function recomputeBusiness(
  deps: AppDeps,
  businessId: string,
  cause: RecalcCause | null,
): Promise<void> {
  const plans = await models(deps)
    .Plan.find({ businessId, implementedAt: { $ne: null } })
    .lean<PlanRecord[]>();
  if (plans.length === 0) return;
  const business = await loadBusiness(deps, businessId);
  for (const plan of plans) await recomputePlan(deps, plan, business, cause);
}
