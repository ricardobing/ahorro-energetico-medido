import {
  billPeriodContaining,
  daysWithoutChange,
  firstMeasurableBillEta,
  formatDayMonth,
  formatMonthName,
  isStalled,
  localeForCountry,
  monthOf,
  type Country,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { loadElectricityBills, models, type PlanRecord } from './common.js';

export interface MeasurementHint {
  /** Mes de la factura que contiene el día del cambio (no cuenta para la medición). */
  excludedMonth: string | null;
  firstMeasurableBillEta: string | null;
  message: string;
}

/** Qué factura no cuenta y cuándo se va a ver el resultado, en palabras de la usuaria. */
export async function measurementHint(
  deps: AppDeps,
  businessId: string,
  country: Country,
  implementedAt: string,
): Promise<MeasurementHint> {
  const bills = await loadElectricityBills(deps, businessId);
  const locale = localeForCountry(country);
  const containing = billPeriodContaining(bills, implementedAt);
  const eta = firstMeasurableBillEta(bills, implementedAt);
  if (!eta)
    return {
      excludedMonth: null,
      firstMeasurableBillEta: null,
      message:
        'Para ver el resultado, sube tus facturas de luz: la última de antes del cambio y las que lleguen después.',
    };
  const when = `El resultado se va a ver con la factura que cierra alrededor del ${formatDayMonth(eta, locale)}.`;
  if (!containing) return { excludedMonth: null, firstMeasurableBillEta: eta, message: when };
  const month = formatMonthName(containing.end, locale);
  return {
    excludedMonth: monthOf(containing.end),
    firstMeasurableBillEta: eta,
    message: `Tu factura de ${month} no cuenta porque incluye el día del cambio. ${when}`,
  };
}

export interface PlanEventView {
  type: string;
  at: string;
  from?: string;
  to?: string;
  data?: Record<string, unknown>;
}

/** Plan con el contrato del anexo más `stalled`, `implementedAt`, los eventos y, si está completo, la pista de medición. */
export async function planView(deps: AppDeps, plan: PlanRecord, country: Country) {
  const events = await models(deps)
    .PlanEvent.find({ planId: plan._id })
    .sort({ at: 1, _id: 1 })
    .lean<(PlanEventView & { _id: unknown })[]>();
  const today = deps.clock.today();
  const state = { status: plan.status, lastStepChangeAt: plan.lastStepChangeAt ?? plan.statusUpdatedAt };
  return {
    id: plan._id,
    ecoCardOrigin: plan.ecoCardOrigin,
    title: plan.title,
    status: plan.status,
    statusUpdatedAt: plan.statusUpdatedAt,
    createdAt: plan.createdAt,
    steps: plan.steps.map((s) => ({
      _id: s._id,
      title: s.title,
      status: s.status,
      subSteps: s.subSteps ?? [],
    })),
    implementedAt: plan.implementedAt ?? null,
    stalled: isStalled(state, today),
    daysWithoutChange: daysWithoutChange(state, today),
    events: events.map(({ _id, ...e }) => e),
    measurementHint:
      plan.status === 'completed' && plan.implementedAt
        ? await measurementHint(deps, plan.businessId, country, plan.implementedAt)
        : null,
    dataSource: plan.dataSource ?? null,
  };
}

export async function addPlanEvent(
  deps: AppDeps,
  plan: Pick<PlanRecord, '_id' | 'businessId'>,
  event: { type: string; from?: string; to?: string; data?: Record<string, unknown> },
): Promise<void> {
  await models(deps).PlanEvent.create({
    planId: plan._id,
    businessId: plan.businessId,
    ...event,
    at: deps.clock.now().toISOString(),
  });
}
