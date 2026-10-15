import type { IsoDate, IsoMonth } from './types.js';

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(value: string): [number, number, number] | null {
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonthOf(y, mo)) return null;
  return [y, mo, d];
}

function daysInMonthOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function mustParse(value: string): [number, number, number] {
  const p = parse(value);
  if (!p) throw new Error(`Fecha inválida: ${value}`);
  return p;
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

/** Días desde 1970-01-01, sin zona horaria. */
export function toDayNumber(value: IsoDate): number {
  const [y, m, d] = mustParse(value);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Inversa de `toDayNumber`. */
export function fromDayNumber(day: number): IsoDate {
  const date = new Date(day * DAY_MS);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** `true` si es una fecha real con formato `AAAA-MM-DD` (incluye bisiestos). */
export function isValidIsoDate(value: string): boolean {
  return parse(value) !== null;
}

/** Días del periodo contando el primero y el último. */
export function daysInclusive(start: IsoDate, end: IsoDate): number {
  return toDayNumber(end) - toDayNumber(start) + 1;
}

/** Negativo si `a` es anterior a `b`, 0 si son iguales, positivo si es posterior. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  return toDayNumber(a) - toDayNumber(b);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Mismo día y mes `years` años después (o antes). El 29 de febrero pasa al 28 si el año no es bisiesto. */
export function shiftYears(date: IsoDate, years: number): IsoDate {
  const [y, m, d] = mustParse(date);
  const year = y + years;
  return `${pad(year, 4)}-${pad(m)}-${pad(Math.min(d, daysInMonthOf(year, m)))}`;
}

/** Días en común entre dos periodos inclusivos (0 si no se tocan). */
export function overlapDays(aStart: IsoDate, aEnd: IsoDate, bStart: IsoDate, bEnd: IsoDate): number {
  const start = Math.max(toDayNumber(aStart), toDayNumber(bStart));
  const end = Math.min(toDayNumber(aEnd), toDayNumber(bEnd));
  return Math.max(0, end - start + 1);
}

export function monthOf(date: IsoDate): IsoMonth {
  mustParse(date);
  return date.slice(0, 7);
}

export function daysInMonth(month: IsoMonth): number {
  const [y, m] = mustParse(`${month}-01`);
  return daysInMonthOf(y, m);
}

export function lastDayOfMonth(month: IsoMonth): IsoDate {
  return `${month}-${pad(daysInMonth(month))}`;
}

/** `true` si el periodo empieza el día 1 y termina el último día del mismo mes. */
export function isCalendarMonth(start: IsoDate, end: IsoDate): boolean {
  return start.endsWith('-01') && end === lastDayOfMonth(monthOf(start));
}

/** Días entre dos fechas (`to` − `from`), sin contar el primero. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Primer día del mes siguiente. */
export function nextMonthStart(month: IsoMonth): IsoDate {
  return addDays(lastDayOfMonth(month), 1);
}
