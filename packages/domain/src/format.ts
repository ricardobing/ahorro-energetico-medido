import type { Cents } from './money.js';
import type { Country, Currency, IsoDate } from './types.js';
import { notImplemented } from './not-implemented.js';

export function currencyForCountry(country: Country): Currency {
  return notImplemented(`currencyForCountry(${country})`);
}

export function localeForCountry(country: Country): string {
  return notImplemented(`localeForCountry(${country})`);
}

/** Monto para mostrar a la usuaria, sin decimales cuando son cero («S/ 1,200», «S/ 92.11»). */
export function formatMoney(cents: Cents, currency: Currency, locale: string): string {
  return notImplemented(`formatMoney(${cents}, ${currency}, ${locale})`);
}

/** «31 de agosto de 2026», igual en cualquier zona horaria. */
export function formatDateLong(date: IsoDate, locale: string): string {
  return notImplemented(`formatDateLong(${date}, ${locale})`);
}

/** «30 de septiembre», sin año. */
export function formatDayMonth(date: IsoDate, locale: string): string {
  return notImplemented(`formatDayMonth(${date}, ${locale})`);
}

/** «enero». */
export function formatMonthName(date: IsoDate, locale: string): string {
  return notImplemented(`formatMonthName(${date}, ${locale})`);
}

/** Porcentaje entero con espacio duro antes del signo: «6 %». */
export function formatPercentInt(value: number): string {
  return notImplemented(`formatPercentInt(${value})`);
}
