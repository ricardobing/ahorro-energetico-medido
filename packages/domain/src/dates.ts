import type { IsoDate, IsoMonth } from './types.js';
import { notImplemented } from './not-implemented.js';

/** `true` si es una fecha real con formato `AAAA-MM-DD` (incluye bisiestos). */
export function isValidIsoDate(value: string): boolean {
  return notImplemented(`isValidIsoDate(${value})`);
}

/** Días del periodo contando el primero y el último. */
export function daysInclusive(start: IsoDate, end: IsoDate): number {
  return notImplemented(`daysInclusive(${start}, ${end})`);
}

/** Negativo si `a` es anterior a `b`, 0 si son iguales, positivo si es posterior. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  return notImplemented(`compareDates(${a}, ${b})`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return notImplemented(`addDays(${date}, ${days})`);
}

/** Mismo día y mes `years` años después (o antes). El 29 de febrero pasa al 28 si el año no es bisiesto. */
export function shiftYears(date: IsoDate, years: number): IsoDate {
  return notImplemented(`shiftYears(${date}, ${years})`);
}

/** Días en común entre dos periodos inclusivos (0 si no se tocan). */
export function overlapDays(aStart: IsoDate, aEnd: IsoDate, bStart: IsoDate, bEnd: IsoDate): number {
  return notImplemented(`overlapDays(${aStart}, ${aEnd}, ${bStart}, ${bEnd})`);
}

export function monthOf(date: IsoDate): IsoMonth {
  return notImplemented(`monthOf(${date})`);
}

export function daysInMonth(month: IsoMonth): number {
  return notImplemented(`daysInMonth(${month})`);
}

export function lastDayOfMonth(month: IsoMonth): IsoDate {
  return notImplemented(`lastDayOfMonth(${month})`);
}

/** `true` si el periodo empieza el día 1 y termina el último día del mismo mes. */
export function isCalendarMonth(start: IsoDate, end: IsoDate): boolean {
  return notImplemented(`isCalendarMonth(${start}, ${end})`);
}

/** Días entre dos fechas (`to` − `from`), sin contar el primero. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return notImplemented(`daysBetween(${from}, ${to})`);
}
