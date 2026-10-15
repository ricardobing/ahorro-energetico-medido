import {
  compareDates,
  daysInclusive,
  daysInMonth,
  fromDayNumber,
  lastDayOfMonth,
  monthOf,
  nextMonthStart,
  overlapDays,
  shiftYears,
  toDayNumber,
} from '../dates.js';
import { toCents } from '../money.js';
import { METHOD_VERSION, MEASUREMENT_PARAMS, type MeasurementParams } from '../params.js';
import { projectBillEnd } from '../plans/index.js';
import type { Bill, HistoryMonth, IsoDate } from '../types.js';
import type {
  ExclusionReason,
  InsufficientReason,
  MeasurementInput,
  MeasurementLabel,
  MeasurementMethod,
  MeasurementResult,
  MeasurementStatus,
  PeriodSummary,
  Savings,
  TariffChange,
} from './types.js';

/** Días y kWh por día de una factura. */
export function normalizeBill(bill: Bill): { days: number; kwhPerDay: number } {
  const days = daysInclusive(bill.billingStartDate, bill.billingEndDate);
  return { days, kwhPerDay: bill.kwhConsumed / days };
}

/**
 * Variación relativa (%) del consumo por día: desvío muestral / media de las facturas dadas.
 * Con menos de 4 facturas devuelve la variación por defecto (3 %).
 */
export function relativeSigmaPct(
  kwhPerDay: number[],
  defaultPct = MEASUREMENT_PARAMS.defaultSigmaPct,
): number {
  if (kwhPerDay.length < MEASUREMENT_PARAMS.minBillsForOwnSigma) return defaultPct;
  const mean = kwhPerDay.reduce((a, b) => a + b, 0) / kwhPerDay.length;
  if (mean <= 0) return defaultPct;
  const variance = kwhPerDay.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (kwhPerDay.length - 1);
  return (Math.sqrt(variance) / mean) * 100;
}

/** Banda de ruido en %: 2 × σ × √(1/nAntes + 1/nDespués). */
export function noiseBandPct(sigmaPct: number, nReference: number, nAfter: number): number {
  return MEASUREMENT_PARAMS.bandMultiplier * Math.abs(sigmaPct) * Math.sqrt(1 / nReference + 1 / nAfter);
}

/** Orden estable: por inicio y después por id. El resultado no depende del orden de carga. */
function byPeriod(a: Bill, b: Bill): number {
  return compareDates(a.billingStartDate, b.billingStartDate) || (a.id < b.id ? -1 : 1);
}

function summarize(bills: Bill[]): PeriodSummary {
  const days = bills.reduce((acc, b) => acc + daysInclusive(b.billingStartDate, b.billingEndDate), 0);
  const kwh = bills.reduce((acc, b) => acc + b.kwhConsumed, 0);
  return { kwhPerDay: kwh / days, days, billIds: bills.map((b) => b.id) };
}

/** Días del periodo que caen en los meses de temporada alta. */
function highSeasonDays(start: IsoDate, end: IsoDate, months: number[]): number {
  if (months.length === 0) return 0;
  let total = 0;
  for (let monthStart = `${monthOf(start)}-01`; compareDates(monthStart, end) <= 0;) {
    const month = monthOf(monthStart);
    if (months.includes(Number(month.slice(5, 7))))
      total += overlapDays(start, end, monthStart, lastDayOfMonth(month));
    monthStart = nextMonthStart(month);
  }
  return total;
}

interface YearAgoSource {
  id: string;
  kind: 'bill' | 'history';
  from: number;
  to: number;
  kwhPerDay: number;
}

interface Coverage {
  coveredDays: number;
  kwh: number;
  sources: YearAgoSource[];
}

/** Cubre cada día de `[from, to]` con una factura (primero) o con el historial estimado del recibo. */
function coverWindow(from: number, to: number, bills: YearAgoSource[], history: YearAgoSource[]): Coverage {
  let coveredDays = 0;
  let kwh = 0;
  const used = new Map<string, YearAgoSource>();
  for (let day = from; day <= to; day++) {
    const source =
      bills.find((s) => s.from <= day && day <= s.to) ?? history.find((s) => s.from <= day && day <= s.to);
    if (!source) continue;
    coveredDays++;
    kwh += source.kwhPerDay;
    used.set(source.id, source);
  }
  return { coveredDays, kwh, sources: [...used.values()] };
}

function billSource(b: Bill): YearAgoSource {
  return {
    id: b.id,
    kind: 'bill',
    from: toDayNumber(b.billingStartDate),
    to: toDayNumber(b.billingEndDate),
    kwhPerDay: normalizeBill(b).kwhPerDay,
  };
}

function historySource(h: HistoryMonth): YearAgoSource {
  const start = `${h.month}-01`;
  return {
    id: `history:${h.month}`,
    kind: 'history',
    from: toDayNumber(start),
    to: toDayNumber(lastDayOfMonth(h.month)),
    kwhPerDay: h.kwh / daysInMonth(h.month),
  };
}

function yearAgoWindow(b: Bill): [number, number] {
  return [toDayNumber(shiftYears(b.billingStartDate, -1)), toDayNumber(shiftYears(b.billingEndDate, -1))];
}

interface YearOverYear {
  baseline: PeriodSummary;
  nReference: number;
  growthFactor: number | null;
  usedHistory: boolean;
}

/** Método interanual: los mismos días del año anterior, con ajuste por crecimiento si hay pares previos. */
function tryYearOverYear(
  after: Bill[],
  pre: Bill[],
  history: HistoryMonth[],
  implementedAt: IsoDate,
  p: MeasurementParams,
): YearOverYear | null {
  const preSources = pre.map(billSource);
  const implDay = toDayNumber(implementedAt);
  const historySources = history.map(historySource).filter((h) => h.to < implDay);

  let coveredDays = 0;
  let kwh = 0;
  const used = new Map<string, YearAgoSource>();
  const afterDays = after.reduce((acc, b) => acc + normalizeBill(b).days, 0);
  for (const bill of after) {
    const [from, to] = yearAgoWindow(bill);
    const c = coverWindow(from, to, preSources, historySources);
    coveredDays += c.coveredDays;
    kwh += c.kwh;
    for (const s of c.sources) used.set(s.id, s);
  }
  if (coveredDays === 0 || coveredDays / afterDays < p.yoyMinCoverage) return null;

  // Pares para el crecimiento: facturas de los 12 meses previos al cambio con su mismo periodo un año antes.
  const yearBefore = shiftYears(implementedAt, -1);
  let recentKwh = 0;
  let olderKwh = 0;
  let pairs = 0;
  let pairsUsedHistory = false;
  for (const bill of pre) {
    if (used.has(bill.id) || compareDates(bill.billingStartDate, yearBefore) < 0) continue;
    const [from, to] = yearAgoWindow(bill);
    const c = coverWindow(
      from,
      to,
      preSources.filter((s) => s.id !== bill.id),
      historySources,
    );
    if (c.coveredDays / normalizeBill(bill).days < p.yoyMinCoverage) continue;
    pairs++;
    recentKwh += normalizeBill(bill).kwhPerDay * c.coveredDays;
    olderKwh += c.kwh;
    if (c.sources.some((s) => s.kind === 'history')) pairsUsedHistory = true;
  }
  const growthFactor = pairs >= p.minGrowthPairs && olderKwh > 0 ? recentKwh / olderKwh : null;

  const sources = [...used.values()].sort((a, b) => a.from - b.from);
  return {
    baseline: {
      kwhPerDay: (kwh / coveredDays) * (growthFactor ?? 1),
      days: coveredDays,
      billIds: sources.filter((s) => s.kind === 'bill').map((s) => s.id),
    },
    nReference: sources.length,
    growthFactor,
    usedHistory: sources.some((s) => s.kind === 'history') || (growthFactor !== null && pairsUsedHistory),
  };
}

/**
 * Cambio de tarifa entre la factura más antigua de los últimos 12 meses y la más reciente. Las facturas
 * llegan ordenadas y sin superponerse (la API rechaza las superposiciones).
 */
function tariffChangeOf(bills: Bill[]): TariffChange | null {
  const latest = bills.at(-1);
  if (!latest) return null;
  const since = fromDayNumber(toDayNumber(shiftYears(latest.billingEndDate, -1)) + 1);
  const oldest = bills.find((b) => compareDates(b.billingStartDate, since) >= 0)!;
  if (oldest.costPerKwh === latest.costPerKwh) return null;
  return {
    fromDate: oldest.billingStartDate,
    fromTariff: oldest.costPerKwh,
    toTariff: latest.costPerKwh,
    changePct: (latest.costPerKwh / oldest.costPerKwh - 1) * 100,
  };
}

/**
 * Medición del ahorro (método 1.0.0). Función pura: los mismos datos dan siempre el mismo resultado,
 * sin importar el orden de las facturas.
 */
export function measureSavings(input: MeasurementInput): MeasurementResult {
  const p: MeasurementParams = { ...MEASUREMENT_PARAMS, ...input.params };
  const bills = [...input.bills].sort(byPeriod);
  const history = input.history ?? [];
  const seasonMonths = (input.ciiu && p.highSeasonMonthsByCiiu[input.ciiu]) || [];
  const isHighSeason = (start: IsoDate, end: IsoDate) =>
    highSeasonDays(start, end, seasonMonths) >= p.highSeasonMinOverlapDays;

  const excluded: { billId: string; reason: ExclusionReason }[] = [];
  const exclude = (billId: string, reason: ExclusionReason) => excluded.push({ billId, reason });

  // Facturas de luz con periodo usable, incluida la que contiene el día del cambio (sirve para proyectar).
  const usable: Bill[] = [];
  for (const b of bills) {
    if (b.serviceType !== 'electricity') {
      exclude(b.id, 'NOT_ELECTRICITY');
      continue;
    }
    const { days } = normalizeBill(b);
    if (days < p.minPeriodDays) exclude(b.id, 'PERIOD_TOO_SHORT');
    else if (days > p.maxPeriodDays) exclude(b.id, 'PERIOD_TOO_LONG');
    else usable.push(b);
  }

  const impl = input.implementedAt;
  const pre: Bill[] = [];
  let after: Bill[] = [];
  for (const b of usable) {
    if (impl === null || compareDates(b.billingEndDate, impl) < 0) pre.push(b);
    else if (compareDates(b.billingStartDate, impl) > 0) after.push(b);
    else exclude(b.id, 'CONTAINS_IMPLEMENTATION_DATE');
  }

  // Variación propia: facturas de los 12 meses anteriores al cambio (o a la última factura).
  const reference = impl ?? usable.at(-1)?.billingEndDate ?? null;
  const sigmaBills = reference
    ? pre.filter((b) => compareDates(b.billingStartDate, shiftYears(reference, -1)) >= 0)
    : [];
  const sigmaPct = relativeSigmaPct(
    sigmaBills.map((b) => normalizeBill(b).kwhPerDay),
    p.defaultSigmaPct,
  );

  const result: MeasurementResult = {
    methodVersion: METHOD_VERSION,
    status: 'INSUFFICIENT_DATA',
    reasons: [],
    method: null,
    labels: [],
    sigmaPct,
    bandPct: null,
    changePct: null,
    growthFactor: null,
    baseline: null,
    after: null,
    savings: null,
    tariffChange: tariffChangeOf(usable),
    excluded,
    nextBillEta: null,
  };
  const insufficient = (reason: InsufficientReason, nextBillEta: IsoDate | null): MeasurementResult => ({
    ...result,
    status: 'INSUFFICIENT_DATA',
    reasons: [reason],
    nextBillEta,
  });

  if (impl === null) return insufficient('NO_IMPLEMENTATION_DATE', null);
  if (after.length === 0) return insufficient('NO_AFTER_BILL', projectBillEnd(usable, impl));

  let method: MeasurementMethod;
  let baseline: PeriodSummary;
  let nReference: number;
  const labels: MeasurementLabel[] = [];
  const yoy = tryYearOverYear(after, pre, history, impl, p);
  if (yoy) {
    method = 'YEAR_OVER_YEAR';
    baseline = yoy.baseline;
    nReference = yoy.nReference;
    result.growthFactor = yoy.growthFactor;
    if (yoy.growthFactor === null) labels.push('NO_GROWTH_ADJUSTMENT');
    if (yoy.usedHistory) labels.push('ESTIMATED_HISTORY');
  } else {
    method = 'RECENT_PERIODS';
    labels.push('NO_SEASONAL_ADJUSTMENT');
    // Las últimas facturas antes del cambio; la temporada alta del rubro no se compara con meses normales.
    const chosen: Bill[] = [];
    for (const b of [...pre].reverse()) {
      if (chosen.length === p.baselineBills) break;
      if (isHighSeason(b.billingStartDate, b.billingEndDate)) exclude(b.id, 'HIGH_SEASON');
      else chosen.unshift(b);
    }
    const comparable = after.filter((b) => {
      if (!isHighSeason(b.billingStartDate, b.billingEndDate)) return true;
      exclude(b.id, 'HIGH_SEASON');
      return false;
    });
    if (chosen.length < p.minBaselineBills)
      return { ...insufficient('NOT_ENOUGH_BASELINE', projectBillEnd(usable, impl)), method, labels };
    if (comparable.length === 0)
      return {
        ...insufficient('HIGH_SEASON', projectBillEnd(usable, impl, isHighSeason)),
        method,
        labels,
        baseline: summarize(chosen),
      };
    after = comparable;
    baseline = summarize(chosen);
    nReference = chosen.length;
  }

  const afterSummary = summarize(after);
  const changePct = (afterSummary.kwhPerDay / baseline.kwhPerDay - 1) * 100;
  const bandPct = noiseBandPct(sigmaPct, nReference, after.length);

  let status: MeasurementStatus;
  let reasons: InsufficientReason[] = [];
  if (changePct <= -bandPct) status = 'MEASURED';
  else if (changePct >= bandPct || after.length >= p.noSavingsAfterBills) status = 'NO_SAVINGS_DETECTED';
  else {
    status = 'INSUFFICIENT_DATA';
    reasons = ['WITHIN_NOISE'];
  }

  let savings: Savings | null = null;
  if (status === 'MEASURED') {
    const tariffPerKwh = after.at(-1)!.costPerKwh;
    const kwhPerDay = baseline.kwhPerDay - afterSummary.kwhPerDay;
    const kwhPerMonth = kwhPerDay * p.daysPerMonth;
    const monthAtBaseline = baseline.kwhPerDay * p.daysPerMonth * tariffPerKwh;
    savings = {
      kwhPerDay,
      kwhInAfterPeriod: kwhPerDay * afterSummary.days,
      kwhPerMonth,
      tariffPerKwh,
      amountPerMonthCents: toCents(kwhPerMonth * tariffPerKwh),
      rangePerMonthCents: [
        toCents((Math.max(0, -changePct - bandPct) / 100) * monthAtBaseline),
        toCents(((-changePct + bandPct) / 100) * monthAtBaseline),
      ],
    };
  }

  return {
    ...result,
    status,
    reasons,
    method,
    labels,
    bandPct,
    changePct,
    baseline,
    after: afterSummary,
    savings,
    nextBillEta: status === 'INSUFFICIENT_DATA' ? projectBillEnd(usable, impl) : null,
  };
}
