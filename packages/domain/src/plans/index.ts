import type { Bill, IsoDate, PlanStatus } from '../types.js';
import { notImplemented } from '../not-implemented.js';

export interface PlanState {
  status: PlanStatus;
  /** Fecha del último cambio de un paso; si nunca cambió, la de creación del plan. */
  lastStepChangeAt: IsoDate;
}

/** Plan en progreso cuyos pasos no cambian hace 28 días o más. */
export function isStalled(plan: PlanState, today: IsoDate): boolean {
  return notImplemented(`isStalled(${plan.status}, ${today})`);
}

export type ImplementedAtCheck = 'OK' | 'REQUIRED' | 'INVALID' | 'FUTURE' | 'TOO_OLD';

/** Valida la fecha en que se terminó de implementar: obligatoria, no futura y de 365 días o menos. */
export function checkImplementedAt(value: IsoDate | null | undefined, today: IsoDate): ImplementedAtCheck {
  return notImplemented(`checkImplementedAt(${String(value)}, ${today})`);
}

/**
 * Fecha estimada de cierre de la primera factura que podrá medir el cambio: la del primer periodo
 * que empieza después de `implementedAt`. Si los periodos son meses calendario, el próximo cierra a
 * fin del mes siguiente; si no, al último cierre se le suma la mediana de días de los periodos.
 */
export function firstMeasurableBillEta(bills: Bill[], implementedAt: IsoDate): IsoDate | null {
  return notImplemented(`firstMeasurableBillEta(${bills.length}, ${implementedAt})`);
}
