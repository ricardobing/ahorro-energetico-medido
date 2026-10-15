import {
  aggregateByEco,
  CIIU_OPTIONS,
  COUNTRY_PARAMS,
  compareDates,
  formatDateLong,
  formatMoney,
  lastDayOfMonth,
  measureSavings,
  median,
  overlapDays,
  PRIVACY_PARAMS,
  suppressCells,
  type Bill,
  type Cell,
  type Currency,
  type MeasurementResult,
  type Outcome,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { ApiError } from '../errors.js';
import { loadCatalog, models, type BillRecord, type BusinessRecord, type PlanRecord } from './common.js';
import type { StoredMeasurement, SyntheticOutcome } from './measurements.js';

export interface Period {
  period: string;
  from: string;
  to: string;
}

/** «2026-T3» → del 1 de julio al 30 de septiembre de 2026. */
export function parsePeriod(value: unknown): Period {
  const match = typeof value === 'string' ? /^(\d{4})-T([1-4])$/.exec(value) : null;
  if (!match)
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'El periodo tiene que tener el formato AAAA-Tn (por ejemplo, 2026-T3).',
    );
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const firstMonth = (quarter - 1) * 3 + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    period: value as string,
    from: `${year}-${pad(firstMonth)}-01`,
    to: lastDayOfMonth(`${year}-${pad(firstMonth + 2)}`),
  };
}

export function previousPeriod(p: Period): string {
  const [year, q] = p.period.split('-T').map(Number) as [number, number];
  return q === 1 ? `${year - 1}-T4` : `${year}-T${q - 1}`;
}

type Category = 'measured' | 'notYet' | 'noSavings' | 'noData';
const HIDDEN = 'menos de 5';
/** Celda con 5 negocios o más que se oculta para que no se pueda deducir otra restando del total. */
const COMPLEMENT = 'oculto';
const HIDDEN_NOTE = 'menos de 5 negocios';

function categoryOf(result: MeasurementResult): Category {
  if (result.status === 'MEASURED') return 'measured';
  if (result.status === 'NO_SAVINGS_DETECTED') return 'noSavings';
  return result.reasons.includes('NOT_ENOUGH_BASELINE') || result.reasons.includes('NO_IMPLEMENTATION_DATE')
    ? 'noData'
    : 'notYet';
}

interface PlanOutcome {
  businessId: string;
  ecoId: string;
  category: Category;
  changePct: number | null;
  evidence: 'with_receipt' | 'declared' | null;
  method: 'YEAR_OVER_YEAR' | 'RECENT_PERIODS' | null;
  kwhPerMonth: number;
  amountPerMonthCents: number;
  currency: Currency;
  afterPeriod: [string, string] | null;
}

/**
 * Resultado de cada plan terminado «al cierre del periodo»: la medición se recalcula solo con las facturas
 * que cerraron hasta esa fecha (la función del dominio es pura, así que el informe es reproducible).
 */
async function outcomesAsOf(deps: AppDeps, p: Period): Promise<PlanOutcome[]> {
  const m = models(deps);
  const plans = await m.Plan.find({ implementedAt: { $ne: null, $lte: p.to } }).lean<PlanRecord[]>();
  const businesses = new Map(
    (
      await m.Business.find({ _id: { $in: [...new Set(plans.map((x) => x.businessId))] } }).lean<
        BusinessRecord[]
      >()
    ).map((b) => [b._id, b]),
  );
  const out: PlanOutcome[] = [];
  for (const plan of plans) {
    const business = businesses.get(plan.businessId);
    if (!business) continue;
    const currency = COUNTRY_PARAMS[business.country].currency;
    const stored = await m.Measurement.findOne({ planId: plan._id, current: true }).lean<StoredMeasurement>();
    const synthetic: SyntheticOutcome | null = stored?.synthetic ?? null;
    if (synthetic) {
      const measuredInTime = synthetic.measuredAt !== null && compareDates(synthetic.measuredAt, p.to) <= 0;
      out.push({
        businessId: plan.businessId,
        ecoId: plan.ecoCardOrigin,
        category: synthetic.category === 'measured' && !measuredInTime ? 'notYet' : synthetic.category,
        changePct: synthetic.changePct,
        evidence: synthetic.evidence,
        method: synthetic.method,
        kwhPerMonth: synthetic.kwhPerMonth ?? 0,
        amountPerMonthCents: synthetic.amountPerMonthCents ?? 0,
        currency,
        afterPeriod: synthetic.measuredAt ? [synthetic.measuredAt, synthetic.measuredAt] : null,
      });
      continue;
    }
    const bills = await m.Bill.find({
      businessId: plan.businessId,
      serviceType: 'electricity',
      deletedAt: null,
      billingEndDate: { $lte: p.to },
    }).lean<BillRecord[]>();
    const history = await m.History.find({ businessId: plan.businessId, serviceType: 'electricity' }).lean<
      { month: string; kwh: number }[]
    >();
    const domainBills: Bill[] = bills.map((b) => ({
      id: b._id,
      serviceType: 'electricity',
      kwhConsumed: b.kwhConsumed ?? 0,
      costPerKwh: b.costPerKwh ?? 0,
      billingStartDate: b.billingStartDate,
      billingEndDate: b.billingEndDate,
    }));
    const result = measureSavings({
      bills: domainBills,
      history: history
        .filter((h) => compareDates(lastDayOfMonth(h.month), p.to) <= 0)
        .map(({ month, kwh }) => ({ month, kwh })),
      implementedAt: plan.implementedAt,
      country: business.country,
      ciiu: business.ciiu,
    });
    const used = new Set([...(result.baseline?.billIds ?? []), ...(result.after?.billIds ?? [])]);
    const usedBills = bills.filter((b) => used.has(b._id));
    const afterBills = bills.filter((b) => result.after?.billIds.includes(b._id));
    out.push({
      businessId: plan.businessId,
      ecoId: plan.ecoCardOrigin,
      category: categoryOf(result),
      changePct: result.changePct,
      evidence:
        usedBills.length > 0 && usedBills.every((b) => b.evidence === 'photo_ok')
          ? 'with_receipt'
          : 'declared',
      method: result.method,
      kwhPerMonth: result.savings?.kwhPerMonth ?? 0,
      amountPerMonthCents: result.savings?.amountPerMonthCents ?? 0,
      currency,
      afterPeriod: afterBills.length
        ? [
            afterBills.map((b) => b.billingStartDate).sort()[0]!,
            afterBills
              .map((b) => b.billingEndDate)
              .sort()
              .at(-1)!,
          ]
        : null,
    });
  }
  return out;
}

const distinct = (items: { businessId: string }[]) => new Set(items.map((i) => i.businessId)).size;

/**
 * Aplica el umbral de 5 negocios y la supresión complementaria (D14). Las celdas en cero se muestran:
 * no dicen nada de ningún negocio.
 */
function protect(
  cells: { key: string; businesses: number; value: number }[],
  totalVisible: boolean,
): Map<string, number | null> {
  const nonZero: Cell[] = cells.filter((c) => c.businesses > 0);
  const hidden = new Set(suppressCells(nonZero, totalVisible));
  return new Map(cells.map((c) => [c.key, c.businesses === 0 ? 0 : hidden.has(c.key) ? null : c.value]));
}

/** Combinaciones: el mismo negocio midió dos ecoinnovaciones con periodos posteriores superpuestos. */
function combosOf(measured: PlanOutcome[]): Set<string> {
  const combos = new Set<string>();
  for (const a of measured)
    for (const b of measured)
      if (
        a !== b &&
        a.businessId === b.businessId &&
        a.afterPeriod &&
        b.afterPeriod &&
        overlapDays(a.afterPeriod[0], a.afterPeriod[1], b.afterPeriod[0], b.afterPeriod[1]) > 0
      )
        combos.add(a.businessId);
  return combos;
}

export interface PartnerReport {
  period: string;
  from: string;
  to: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  sectors: { ciiu: string; label: string }[];
  countries: string[];
  byStatus: Record<Category, number | string>;
  byEco: { ecoId: string; title: string; businesses: number | string; medianChangePct: number | null }[];
  combos: number | string;
  measured: {
    businesses: number | string;
    kwhPerMonth: number | null;
    co2KgPerMonth: number | null;
    evidence: { withReceipt: number | null; declared: number | null; hiddenNote: string | null };
    method: Record<string, number | string>;
  };
  declared: { label: string; forms: number | string; medianScale: number | null; scaleNote: string };
  amounts: {
    currency: Currency;
    businesses: number | string;
    amountPerMonthCents: number | null;
    /** «menos de 5» (pocos negocios) u «oculto» (se podría deducir restando del total en USD). */
    hiddenReason: string | null;
    amountText: string | null;
  }[];
  usd: number | null;
  usdNote: string;
  adjustments: {
    period: string;
    note: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }[];
  notes: string[];
}

async function coreReport(deps: AppDeps, p: Period): Promise<Omit<PartnerReport, 'adjustments'>> {
  const outcomes = await outcomesAsOf(deps, p);
  const businesses = await models(deps)
    .Business.find({ _id: { $in: [...new Set(outcomes.map((o) => o.businessId))] } })
    .lean<BusinessRecord[]>();
  const catalog = await loadCatalog(deps);

  const byCategory = (c: Category) => outcomes.filter((o) => o.category === c);
  const statusCells = (['measured', 'notYet', 'noSavings', 'noData'] as const).map((key) => ({
    key,
    businesses: distinct(byCategory(key)),
    value: byCategory(key).length,
  }));
  const status = protect(statusCells, true);

  const measured = byCategory('measured');
  const combos = combosOf(measured);
  const aggregate = aggregateByEco(
    measured.map((o): Outcome => ({
      businessId: o.businessId,
      ecoId: o.ecoId,
      changePct: o.changePct ?? 0,
      combo: combos.has(o.businessId),
      evidence: o.evidence ?? 'declared',
      method: o.method ?? 'RECENT_PERIODS',
    })),
  );
  const measuredBusinesses = distinct(measured);
  const enough = measuredBusinesses >= PRIVACY_PARAMS.minBusinessesForNumber;

  const evidenceCells = (['with_receipt', 'declared'] as const).map((key) => {
    const items = measured.filter((o) => o.evidence === key);
    return { key, businesses: distinct(items), value: items.length };
  });
  const evidence = protect(evidenceCells, true);
  const methodCells = (['RECENT_PERIODS', 'YEAR_OVER_YEAR'] as const)
    .map((key) => {
      const items = measured.filter((o) => o.method === key);
      return { key, businesses: distinct(items), value: items.length };
    })
    .filter((c) => c.value > 0);
  const method = protect(methodCells, true);

  // Montos por moneda; el equivalente en USD es un total visible, así que exige supresión complementaria.
  const currencies = [...new Set(outcomes.map((o) => o.currency))].sort() as Currency[];
  const rates = new Map<Currency, number>();
  let usdAvailable = true;
  try {
    for (const c of currencies) rates.set(c, await deps.services.currency.rate(c, 'USD', p.to));
  } catch {
    usdAvailable = false;
  }
  const amountCells = currencies.map((currency) => {
    const items = measured.filter((o) => o.currency === currency);
    return {
      key: currency,
      businesses: distinct(items),
      value: items.reduce((acc, o) => acc + o.amountPerMonthCents, 0),
    };
  });
  const amounts = protect(amountCells, usdAvailable);
  const usd =
    usdAvailable && enough
      ? Math.round(
          amountCells.reduce((acc, c) => acc + (c.value / 100) * (rates.get(c.key as Currency) ?? 0), 0) *
            100,
        ) / 100
      : null;

  const forms = await models(deps)
    .Perceived.find({ submittedAt: { $gte: p.from, $lte: p.to } })
    .lean<{ businessId: string; scale: number }[]>();
  const formsVisible = distinct(forms) >= PRIVACY_PARAMS.minBusinessesForNumber;

  /** Valor visible, o el motivo por el que se oculta: pocos negocios o supresión complementaria. */
  const shown = (
    cells: { key: string; businesses: number }[],
    values: Map<string, number | null>,
    key: string,
  ): number | string => {
    const value = values.get(key);
    if (value !== null && value !== undefined) return value;
    const businesses = cells.find((c) => c.key === key)?.businesses ?? 0;
    return businesses >= PRIVACY_PARAMS.minBusinessesForNumber ? COMPLEMENT : HIDDEN;
  };
  const anyHidden = (map: Map<string, number | null>) => [...map.values()].some((v) => v === null);

  return {
    period: p.period,
    from: p.from,
    to: p.to,
    status: 'open',
    closedAt: null,
    sectors: [...new Set(businesses.map((b) => b.ciiu).filter((c): c is string => Boolean(c)))]
      .sort()
      .map((ciiu) => ({
        ciiu,
        label: CIIU_OPTIONS.find((o) => o.code === ciiu)?.label ?? ciiu,
      })),
    countries: [...new Set(businesses.map((b) => b.country))].sort(),
    byStatus: {
      measured: shown(statusCells, status, 'measured'),
      notYet: shown(statusCells, status, 'notYet'),
      noSavings: shown(statusCells, status, 'noSavings'),
      noData: shown(statusCells, status, 'noData'),
    },
    byEco: aggregate.rows.map((r) => ({
      ecoId: r.ecoId,
      title: catalog.find((e) => e.id === r.ecoId)?.title ?? r.ecoId,
      businesses: r.visibility === 'NUMBER' ? r.businesses : HIDDEN,
      medianChangePct: r.medianChangePct === null ? null : Math.round(r.medianChangePct),
    })),
    combos:
      aggregate.combos === 0 || aggregate.combos >= PRIVACY_PARAMS.minBusinessesForNumber
        ? aggregate.combos
        : HIDDEN,
    measured: {
      businesses: enough ? measuredBusinesses : HIDDEN,
      kwhPerMonth: enough ? Math.round(measured.reduce((acc, o) => acc + o.kwhPerMonth, 0) * 10) / 10 : null,
      co2KgPerMonth: enough
        ? Math.round(
            measured.reduce(
              (acc, o) =>
                acc +
                o.kwhPerMonth *
                  COUNTRY_PARAMS[businesses.find((b) => b._id === o.businessId)?.country ?? 'PE'].co2KgPerKwh,
              0,
            ) * 10,
          ) / 10
        : null,
      evidence: {
        withReceipt: evidence.get('with_receipt') ?? null,
        declared: evidence.get('declared') ?? null,
        hiddenNote: anyHidden(evidence) ? HIDDEN_NOTE : null,
      },
      method: Object.fromEntries([...method.keys()].map((k) => [k, shown(methodCells, method, k)])),
    },
    declared: {
      label: 'declarado por las usuarias, no medido',
      forms: formsVisible ? forms.length : HIDDEN,
      medianScale: formsVisible ? median(forms.map((f) => f.scale)) : null,
      scaleNote: 'Escala del formulario de impacto percibido: de 1 (nada) a 5 (mucho).',
    },
    amounts: amountCells.map((c) => {
      const value = amounts.get(c.key) ?? null;
      return {
        currency: c.key as Currency,
        businesses: c.businesses >= PRIVACY_PARAMS.minBusinessesForNumber ? c.businesses : HIDDEN,
        amountPerMonthCents: value,
        hiddenReason:
          value !== null ? null : c.businesses >= PRIVACY_PARAMS.minBusinessesForNumber ? COMPLEMENT : HIDDEN,
        amountText:
          value === null ? null : formatMoney(value, c.key as Currency, c.key === 'BOB' ? 'es-BO' : 'es-PE'),
      };
    }),
    usd,
    usdNote: usdAvailable
      ? `Equivalente en USD por mes con el tipo de cambio del ${formatDateLong(p.to, 'es-PE')} (sintético en esta demostración).`
      : 'Equivalente en USD no disponible en este momento',
    notes: [
      'Ahorro por mes a la tarifa vigente de cada negocio. Solo se muestran números que vienen de 5 negocios o más.',
      'Datos sintéticos de demostración, salvo la tabla de negocios similares del caso.',
    ],
  };
}

/** Partes del informe que, si cambian después del cierre, generan un ajuste en el periodo siguiente. */
const comparable = (r: Omit<PartnerReport, 'adjustments'>) => ({
  byStatus: r.byStatus,
  byEco: r.byEco,
  measured: r.measured,
  amounts: r.amounts.map(({ currency, businesses, amountPerMonthCents }) => ({
    currency,
    businesses,
    amountPerMonthCents,
  })),
});

export async function partnerReport(deps: AppDeps, p: Period): Promise<PartnerReport> {
  const m = models(deps);
  const closed = await m.PartnerReport.findById(p.period).lean<{
    snapshot: PartnerReport;
    closedAt: string;
  }>();
  if (closed) return { ...closed.snapshot, status: 'closed', closedAt: closed.closedAt };

  const core = await coreReport(deps, p);
  const adjustments: PartnerReport['adjustments'] = [];
  const prev = parsePeriod(previousPeriod(p));
  const prevClosed = await m.PartnerReport.findById(prev.period).lean<{ snapshot: PartnerReport }>();
  if (prevClosed) {
    const before = comparable(prevClosed.snapshot);
    const after = comparable(await coreReport(deps, prev));
    if (JSON.stringify(before) !== JSON.stringify(after))
      adjustments.push({
        period: prev.period,
        note: `Correcciones de facturas posteriores al cierre de ${prev.period}. El informe cerrado no cambia; la diferencia se informa acá.`,
        before,
        after,
      });
  }
  return { ...core, adjustments };
}

export async function closePartnerReport(deps: AppDeps, p: Period): Promise<PartnerReport> {
  if (compareDates(deps.clock.today(), p.to) <= 0)
    throw new ApiError(
      409,
      'PERIOD_NOT_ENDED',
      'El periodo todavía no terminó: se puede cerrar después del último día.',
    );
  const m = models(deps);
  if (await m.PartnerReport.exists({ _id: p.period }))
    throw new ApiError(409, 'ALREADY_CLOSED', 'Ese periodo ya está cerrado.');
  const snapshot = await partnerReport(deps, p);
  const closedAt = deps.clock.now().toISOString();
  await m.PartnerReport.create({ _id: p.period, status: 'closed', closedAt, snapshot });
  return { ...snapshot, status: 'closed', closedAt };
}
