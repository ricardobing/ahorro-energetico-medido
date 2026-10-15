import { compareDates, daysInclusive, isValidIsoDate, overlapDays } from '../dates.js';
import { kwhTimesTariffCents, type Cents } from '../money.js';
import { BILL_PARAMS, COUNTRY_PARAMS } from '../params.js';
import type { Country, IsoDate, ServiceType } from '../types.js';

/** Datos que llegan del formulario o de la API (`POST /user-bill`, campos del anexo). */
export interface BillInput {
  serviceType: ServiceType;
  kwhConsumed: number;
  costPerKwh: number;
  billingStartDate: IsoDate;
  billingEndDate: IsoDate;
}

export type BillErrorCode =
  | 'INVALID_DATE'
  | 'START_AFTER_END'
  | 'FUTURE_DATE'
  | 'PERIOD_TOO_LONG'
  | 'KWH_NOT_POSITIVE'
  | 'KWH_TOO_LARGE'
  | 'TARIFF_OUT_OF_RANGE';

export interface BillError {
  field: keyof BillInput;
  code: BillErrorCode;
  /** Mensaje para la usuaria, en español neutro. */
  message: string;
}

const MESSAGES: Record<BillErrorCode, string> = {
  INVALID_DATE: 'Esa fecha no existe. Revisa el día y el mes.',
  START_AFTER_END: 'La fecha de inicio tiene que ser anterior a la de cierre.',
  FUTURE_DATE: 'La fecha de cierre no puede ser posterior a hoy.',
  PERIOD_TOO_LONG: `El periodo no puede durar más de ${BILL_PARAMS.maxPeriodDays} días. Revisa las fechas.`,
  KWH_NOT_POSITIVE: 'El consumo tiene que ser mayor que cero.',
  KWH_TOO_LARGE: 'Ese consumo es demasiado alto. Revisa que no sobre un cero.',
  TARIFF_OUT_OF_RANGE: '',
};

/** Valida una factura antes de guardarla. Lista vacía = válida. */
export function validateBillInput(input: BillInput, ctx: { country: Country; today: IsoDate }): BillError[] {
  const errors: BillError[] = [];
  const add = (field: keyof BillInput, code: BillErrorCode, message = MESSAGES[code]) =>
    errors.push({ field, code, message });

  const startOk = isValidIsoDate(input.billingStartDate);
  const endOk = isValidIsoDate(input.billingEndDate);
  if (!startOk) add('billingStartDate', 'INVALID_DATE');
  if (!endOk) add('billingEndDate', 'INVALID_DATE');
  if (startOk && endOk) {
    if (compareDates(input.billingStartDate, input.billingEndDate) >= 0)
      add('billingStartDate', 'START_AFTER_END');
    else if (daysInclusive(input.billingStartDate, input.billingEndDate) > BILL_PARAMS.maxPeriodDays)
      add('billingEndDate', 'PERIOD_TOO_LONG');
  }
  if (endOk && isValidIsoDate(ctx.today) && compareDates(input.billingEndDate, ctx.today) > 0)
    add('billingEndDate', 'FUTURE_DATE');

  if (!Number.isFinite(input.kwhConsumed) || input.kwhConsumed <= 0) add('kwhConsumed', 'KWH_NOT_POSITIVE');
  else if (input.kwhConsumed > BILL_PARAMS.maxKwh) add('kwhConsumed', 'KWH_TOO_LARGE');

  const { min, max } = COUNTRY_PARAMS[ctx.country].tariffRange;
  if (!Number.isFinite(input.costPerKwh) || input.costPerKwh < min || input.costPerKwh > max)
    add(
      'costPerKwh',
      'TARIFF_OUT_OF_RANGE',
      `El precio por kWh tiene que estar entre ${min.toFixed(2)} y ${max.toFixed(2)}. Lo encuentras en tu factura, cerca del consumo.`,
    );
  return errors;
}

/** Lo mínimo de una factura (de luz o de agua) para comparar periodos. */
export interface PeriodLike {
  id?: string;
  serviceType: ServiceType;
  billingStartDate: IsoDate;
  billingEndDate: IsoDate;
}

/** Factura vigente del mismo servicio cuyo periodo se superpone con el nuevo (ignora la misma factura), o `null`. */
export function findOverlap<T extends PeriodLike>(candidate: PeriodLike, existing: T[]): T | null {
  const hit = existing
    .filter((b) => b.serviceType === candidate.serviceType)
    .filter((b) => candidate.id === undefined || b.id !== candidate.id)
    .filter(
      (b) =>
        overlapDays(
          candidate.billingStartDate,
          candidate.billingEndDate,
          b.billingStartDate,
          b.billingEndDate,
        ) > 0,
    )
    .sort((a, b) => compareDates(a.billingStartDate, b.billingStartDate));
  return hit[0] ?? null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * `true` si el consumo por día es menor a 0,3 o mayor a 3 veces la mediana de las facturas
 * anteriores del mismo servicio. Sin facturas anteriores no hay con qué comparar: `false`.
 */
export function isAtypical(kwhPerDay: number, previousKwhPerDay: number[]): boolean {
  if (previousKwhPerDay.length === 0) return false;
  const m = median(previousKwhPerDay);
  if (m <= 0) return false;
  const ratio = kwhPerDay / m;
  return ratio < BILL_PARAMS.atypicalLow || ratio > BILL_PARAMS.atypicalHigh;
}

/** `totalCost` de la respuesta: kWh × tarifa, en céntimos exactos. */
export function billTotalCents(kwhConsumed: number, costPerKwh: number): Cents {
  return kwhTimesTariffCents(kwhConsumed, costPerKwh);
}

/** `co2Equivalent` de la respuesta, en kg, con el factor del país. */
export function co2EquivalentKg(kwhConsumed: number, country: Country): number {
  return Math.round(kwhConsumed * COUNTRY_PARAMS[country].co2KgPerKwh * 1000) / 1000;
}
