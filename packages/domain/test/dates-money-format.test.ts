import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addDays,
  canonicalJson,
  compareDates,
  currencyForCountry,
  daysBetween,
  daysInclusive,
  daysInMonth,
  formatDateLong,
  formatDayMonth,
  formatMoney,
  formatMonthName,
  formatPercentInt,
  isCalendarMonth,
  isValidIsoDate,
  kwhTimesTariffCents,
  lastDayOfMonth,
  localeForCountry,
  monthOf,
  overlapDays,
  roundToStep,
  shiftYears,
  toCents,
} from '../src/index.js';
import { plain } from './helpers.js';

describe('Días inclusivos y fechas sin hora', () => {
  it('Meses de distinta duración', () => {
    expect(daysInclusive('2026-02-01', '2026-02-28')).toBe(28);
    expect(daysInclusive('2026-03-01', '2026-03-31')).toBe(31);
    expect(daysInclusive('2026-04-01', '2026-04-30')).toBe(30);
    expect(daysInclusive('2028-02-01', '2028-02-29')).toBe(29);
  });

  it('Zona horaria', () => {
    const original = process.env.TZ;
    try {
      for (const tz of ['America/Lima', 'America/La_Paz', 'Asia/Tokyo', 'UTC']) {
        process.env.TZ = tz;
        expect(formatDateLong('2026-02-28', 'es-PE')).toBe('28 de febrero de 2026');
      }
    } finally {
      process.env.TZ = original;
    }
  });

  it('valida fechas reales, incluidos los bisiestos', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('26-02-01')).toBe(false);
  });

  it('compara, suma días y calcula distancias sin zona horaria', () => {
    expect(compareDates('2026-02-28', '2026-03-01')).toBeLessThan(0);
    expect(compareDates('2026-03-01', '2026-03-01')).toBe(0);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-04-12', '2026-07-10')).toBe(89);
  });

  it('desplaza un año y pasa el 29 de febrero al 28', () => {
    expect(shiftYears('2026-08-15', -1)).toBe('2025-08-15');
    expect(shiftYears('2028-02-29', -1)).toBe('2027-02-28');
  });

  it('cuenta los días en común entre periodos', () => {
    expect(overlapDays('2026-02-15', '2026-03-14', '2026-02-01', '2026-02-28')).toBe(14);
    expect(overlapDays('2026-01-01', '2026-01-31', '2026-02-01', '2026-02-28')).toBe(0);
  });

  it('trabaja con meses calendario', () => {
    expect(monthOf('2026-09-30')).toBe('2026-09');
    expect(daysInMonth('2028-02')).toBe(29);
    expect(lastDayOfMonth('2026-09')).toBe('2026-09-30');
    expect(isCalendarMonth('2026-02-01', '2026-02-28')).toBe(true);
    expect(isCalendarMonth('2026-02-15', '2026-03-14')).toBe(false);
  });
});

describe('Dinero en céntimos', () => {
  it('multiplica kWh por tarifa sin errores de coma flotante', () => {
    expect(kwhTimesTariffCents(1690, 0.78)).toBe(131_820);
    expect(kwhTimesTariffCents(1720, 0.84)).toBe(144_480);
    expect(kwhTimesTariffCents(1760, 0.81)).toBe(142_560);
  });

  it('redondea a céntimos y a pasos de S/ 5 o S/ 10', () => {
    expect(toCents(92.111)).toBe(9211);
    expect(toCents(0.005)).toBe(1);
    expect(roundToStep(9211, 500)).toBe(9000);
    expect(roundToStep(2244, 1000)).toBe(2000);
    expect(roundToStep(16_178, 1000)).toBe(16_000);
  });
});

describe('Idioma y formatos', () => {
  it('Monto en Perú', () => {
    expect(plain(formatMoney(120_000, 'PEN', 'es-PE'))).toBe('S/ 1,200');
    expect(plain(formatDateLong('2026-08-31', 'es-PE'))).toBe('31 de agosto de 2026');
  });

  it('muestra céntimos solo cuando no son cero', () => {
    expect(plain(formatMoney(9211, 'PEN', 'es-PE'))).toBe('S/ 92.11');
    expect(plain(formatMoney(9000, 'PEN', 'es-PE'))).toBe('S/ 90');
  });

  it('formatea día y mes, nombre de mes y porcentaje entero', () => {
    expect(formatDayMonth('2026-09-30', 'es-PE')).toBe('30 de septiembre');
    expect(formatMonthName('2026-01-01', 'es-PE')).toBe('enero');
    expect(plain(formatPercentInt(6.2057))).toBe('6 %');
    expect(plain(formatPercentInt(7.6923))).toBe('8 %');
  });

  it('elige moneda y configuración regional por país', () => {
    expect(currencyForCountry('PE')).toBe('PEN');
    expect(currencyForCountry('BO')).toBe('BOB');
    expect(localeForCountry('PE')).toBe('es-PE');
    expect(localeForCountry('BO')).toBe('es-BO');
  });
});

describe('Huella canónica', () => {
  it('dos objetos iguales con las claves en otro orden dan el mismo JSON canónico', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.oneof(fc.integer(), fc.string(), fc.boolean())), (obj) => {
        const reversed = Object.fromEntries(Object.entries(obj).reverse());
        expect(canonicalJson({ a: obj, b: [1, 2, 3] })).toBe(canonicalJson({ b: [1, 2, 3], a: reversed }));
      }),
      { numRuns: 200 },
    );
  });

  it('respeta el orden de los arreglos', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});
