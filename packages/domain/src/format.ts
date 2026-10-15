import type { Cents } from './money.js';
import { COUNTRY_PARAMS } from './params.js';
import type { Country, Currency, IsoDate } from './types.js';

/** Espacio duro: une número y signo para que no se separen al cortar la línea. */
export const NBSP = String.fromCharCode(0xa0);

export function currencyForCountry(country: Country): Currency {
  return COUNTRY_PARAMS[country].currency;
}

export function localeForCountry(country: Country): string {
  return COUNTRY_PARAMS[country].locale;
}

/** Monto para mostrar a la usuaria, sin decimales cuando son cero («S/ 1,200», «S/ 92.11»). */
export function formatMoney(cents: Cents, currency: Currency, locale: string): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

/**
 * Nombres de los meses en minúscula. Tabla propia y no `Intl`: el ICU de cada versión de Node y de cada
 * navegador no coincide (el de `es-PE` dice «setiembre» y pone mayúscula al mes suelto), y la web, el correo
 * y el reporte tienen que decir lo mismo.
 */
const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

function parts(date: IsoDate): { year: number; month: string; day: number } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return { year: y, month: MONTHS_ES[m - 1]!, day: d };
}

/** «31 de agosto de 2026», igual en cualquier zona horaria. */
export function formatDateLong(date: IsoDate, _locale: string): string {
  const { year, month, day } = parts(date);
  return `${day} de ${month} de ${year}`;
}

/** «30 de septiembre», sin año. */
export function formatDayMonth(date: IsoDate, _locale: string): string {
  const { month, day } = parts(date);
  return `${day} de ${month}`;
}

/** «enero». */
export function formatMonthName(date: IsoDate, _locale: string): string {
  return parts(date).month;
}

/** Porcentaje entero con espacio duro antes del signo: «6 %». */
export function formatPercentInt(value: number): string {
  return `${Math.round(value)}${NBSP}%`;
}
