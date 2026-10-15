import type { Cents } from '../money.js';
import type { Country, IsoDate, ServiceType } from '../types.js';
import { notImplemented } from '../not-implemented.js';

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

/** Valida una factura antes de guardarla. Lista vacía = válida. */
export function validateBillInput(input: BillInput, ctx: { country: Country; today: IsoDate }): BillError[] {
  return notImplemented(`validateBillInput(${input.billingStartDate}, ${ctx.country})`);
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
  return notImplemented(`findOverlap(${candidate.billingStartDate}, ${existing.length})`);
}

/**
 * `true` si el consumo por día es menor a 0,3 o mayor a 3 veces la mediana de las facturas
 * anteriores del mismo servicio. Sin facturas anteriores no hay con qué comparar: `false`.
 */
export function isAtypical(kwhPerDay: number, previousKwhPerDay: number[]): boolean {
  return notImplemented(`isAtypical(${kwhPerDay}, ${previousKwhPerDay.length})`);
}

/** `totalCost` de la respuesta: kWh × tarifa, en céntimos exactos. */
export function billTotalCents(kwhConsumed: number, costPerKwh: number): Cents {
  return notImplemented(`billTotalCents(${kwhConsumed}, ${costPerKwh})`);
}

/** `co2Equivalent` de la respuesta, en kg, con el factor del país. */
export function co2EquivalentKg(kwhConsumed: number, country: Country): number {
  return notImplemented(`co2EquivalentKg(${kwhConsumed}, ${country})`);
}
