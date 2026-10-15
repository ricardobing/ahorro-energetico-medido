import {
  addDays,
  compareDates,
  daysBetween,
  daysInclusive,
  isCalendarMonth,
  isValidIsoDate,
  lastDayOfMonth,
  monthOf,
} from '../dates.js';
import { PLAN_PARAMS } from '../params.js';
import type { Bill, IsoDate, PlanStatus } from '../types.js';

export interface PlanState {
  status: PlanStatus;
  /** Fecha del último cambio de un paso; si nunca cambió, la de creación del plan. */
  lastStepChangeAt: IsoDate;
}

/** Plan en progreso cuyos pasos no cambian hace 28 días o más. */
export function isStalled(plan: PlanState, today: IsoDate): boolean {
  return (
    plan.status === 'in_progress' && daysBetween(plan.lastStepChangeAt, today) >= PLAN_PARAMS.stalledAfterDays
  );
}

/** Días sin cambios de un plan (0 si el último cambio es de hoy o posterior). */
export function daysWithoutChange(plan: PlanState, today: IsoDate): number {
  return Math.max(0, daysBetween(plan.lastStepChangeAt, today));
}

export type ImplementedAtCheck = 'OK' | 'REQUIRED' | 'INVALID' | 'FUTURE' | 'TOO_OLD';

/** Valida la fecha en que se terminó de implementar: obligatoria, no futura y de 365 días o menos. */
export function checkImplementedAt(value: IsoDate | null | undefined, today: IsoDate): ImplementedAtCheck {
  if (value === null || value === undefined || value === '') return 'REQUIRED';
  if (!isValidIsoDate(value)) return 'INVALID';
  if (compareDates(value, today) > 0) return 'FUTURE';
  if (daysBetween(value, today) > PLAN_PARAMS.implementedAtMaxAgeDays) return 'TOO_OLD';
  return 'OK';
}

function medianDays(bills: Bill[]): number {
  const days = bills.map((b) => daysInclusive(b.billingStartDate, b.billingEndDate)).sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  return days.length % 2 ? days[mid]! : Math.round((days[mid - 1]! + days[mid]!) / 2);
}

/**
 * Proyecta las próximas facturas a partir de la última y devuelve el cierre de la primera que empieza
 * después de `startsAfter` y que `skip` no descarta. Si los periodos son meses calendario, cada una cierra
 * a fin de mes; si no, dura la mediana de días de los periodos. `null` si no hay facturas.
 */
export function projectBillEnd(
  bills: Bill[],
  startsAfter: IsoDate,
  skip: (start: IsoDate, end: IsoDate) => boolean = () => false,
): IsoDate | null {
  const electricity = bills.filter((b) => b.serviceType === 'electricity');
  if (electricity.length === 0) return null;
  const last = electricity.reduce((a, b) => (compareDates(b.billingEndDate, a.billingEndDate) > 0 ? b : a));
  const calendar = electricity.every((b) => isCalendarMonth(b.billingStartDate, b.billingEndDate));
  const length = medianDays(electricity);
  let end = last.billingEndDate;
  // Tope de cinco años de periodos proyectados: más allá no tiene sentido estimar.
  for (let i = 0; i < 60; i++) {
    const start = addDays(end, 1);
    end = calendar ? lastDayOfMonth(monthOf(start)) : addDays(start, length - 1);
    if (compareDates(start, startsAfter) > 0 && !skip(start, end)) return end;
  }
  return null;
}

/**
 * Fecha estimada de cierre de la primera factura que podrá medir el cambio: la del primer periodo
 * que empieza después de `implementedAt`. Si los periodos son meses calendario, el próximo cierra a
 * fin del mes siguiente; si no, al último cierre se le suma la mediana de días de los periodos.
 */
export function firstMeasurableBillEta(bills: Bill[], implementedAt: IsoDate): IsoDate | null {
  const existing = bills
    .filter((b) => b.serviceType === 'electricity' && compareDates(b.billingStartDate, implementedAt) > 0)
    .sort((a, b) => compareDates(a.billingStartDate, b.billingStartDate));
  if (existing[0]) return existing[0].billingEndDate;
  return projectBillEnd(bills, implementedAt);
}
