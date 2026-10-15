import { describe, expect, it } from 'vitest';
import { measureSavings, noiseBandPct, normalizeBill, relativeSigmaPct, type Bill } from '../src/index.js';
import { INES_IMPLEMENTED_AT, INES_RECEIPT_HISTORY_2025, monthlyBill } from '@ppam/fixtures';
import { billWithDaily, inesBills, simulatedBills } from './helpers.js';

const IMPL = INES_IMPLEMENTED_AT; // 2026-07-08

function measure(
  bills: Bill[],
  implementedAt: string | null = IMPL,
  extra: Partial<Parameters<typeof measureSavings>[0]> = {},
) {
  return measureSavings({ bills, implementedAt, country: 'PE', ciiu: '1071', ...extra });
}

describe('Comparación en kWh por día', () => {
  it('Febrero contra enero', () => {
    const [jan, feb] = inesBills();
    const kJan = normalizeBill(jan!).kwhPerDay;
    const kFeb = normalizeBill(feb!).kwhPerDay;
    expect(kJan).toBeCloseTo(59.35, 2);
    expect(kFeb).toBeCloseTo(60.36, 2);
    expect((kFeb / kJan - 1) * 100).toBeCloseTo(1.69, 2);
    expect(measure([jan!, feb!], null).status).not.toBe('MEASURED');
  });
});

describe('Ningún ahorro sin implementación ni factura posterior', () => {
  it('Inés hoy', () => {
    const r = measure(inesBills(), null);
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.reasons).toEqual(['NO_IMPLEMENTATION_DATE']);
    expect(r.savings).toBeNull();
    expect(r.method).toBeNull();
  });

  it('Sin factura posterior', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul'])]);
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.reasons).toEqual(['NO_AFTER_BILL']);
    expect(r.nextBillEta).toBe('2026-08-31');
  });
});

describe('Exclusión de la factura del cambio', () => {
  it('Julio de Inés (sintético)', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul', 'ago'])]);
    expect(r.excluded).toContainEqual({
      billId: 'bill_ines_2026_07',
      reason: 'CONTAINS_IMPLEMENTATION_DATE',
    });
    expect(r.baseline?.billIds).not.toContain('bill_ines_2026_07');
    expect(r.after?.billIds).toEqual(['bill_ines_2026_08']);
  });
});

describe('Elección del método de comparación', () => {
  it('Periodos cercanos para Inés (sintético desde agosto)', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul', 'ago'])]);
    expect(r.method).toBe('RECENT_PERIODS');
    expect(r.baseline?.billIds).toEqual(['bill_ines_2026_04', 'bill_ines_2026_05', 'bill_ines_2026_06']);
    expect(r.baseline?.days).toBe(91);
    expect(r.baseline?.kwhPerDay).toBeCloseTo(58.9011, 4);
    expect(r.labels).toContain('NO_SEASONAL_ADJUSTMENT');
  });

  it('Interanual (sintético)', () => {
    const lastYear = [
      monthlyBill('b_2025_08', '2025-08', 1700, 0.75),
      monthlyBill('b_2025_09', '2025-09', 1650, 0.75),
    ];
    const r = measure([...lastYear, ...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);
    expect(r.method).toBe('YEAR_OVER_YEAR');
    expect(r.baseline?.kwhPerDay).toBeCloseTo(3350 / 61, 4);
    expect(r.labels).not.toContain('NO_SEASONAL_ADJUSTMENT');
  });

  it('Línea de base insuficiente', () => {
    const bills = inesBills().filter((b) => b.id === 'bill_ines_2026_06');
    const r = measure([...bills, ...simulatedBills(['ago'])]);
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.reasons).toEqual(['NOT_ENOUGH_BASELINE']);
  });
});

describe('Ajuste por crecimiento en el método interanual', () => {
  // Sintético: en 2025 consumía 50 kWh/día; en abril-junio de 2026, 52,5 (5 % más); después del cambio, 50 otra vez.
  const months2025 = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09'];
  const lastYear = months2025.map((m, i) => billWithDaily(`y25_${i}`, m, 50));
  const before2026 = ['2026-04', '2026-05', '2026-06'].map((m, i) => billWithDaily(`y26_${i}`, m, 52.5));
  const after2026 = [
    billWithDaily('y26_jul', '2026-07', 51),
    billWithDaily('y26_ago', '2026-08', 50),
    billWithDaily('y26_sep', '2026-09', 50),
  ];

  it('Negocio que ya venía creciendo (sintético)', () => {
    const r = measure([...lastYear, ...before2026, ...after2026]);
    expect(r.method).toBe('YEAR_OVER_YEAR');
    expect(r.growthFactor).toBeCloseTo(1.05, 6);
    expect(r.baseline?.kwhPerDay).toBeCloseTo(52.5, 6);
    expect(r.changePct).toBeCloseTo((50 / 52.5 - 1) * 100, 6);
    expect(r.labels).not.toContain('NO_GROWTH_ADJUSTMENT');
  });

  it('Sin pares previos', () => {
    const onlyAfterPairs = lastYear.filter((b) => b.billingStartDate >= '2025-07-01');
    const r = measure([...onlyAfterPairs, ...before2026, ...after2026]);
    expect(r.method).toBe('YEAR_OVER_YEAR');
    expect(r.labels).toContain('NO_GROWTH_ADJUSTMENT');
    expect(r.growthFactor).toBeNull();
  });
});

describe('Temporada alta del rubro', () => {
  it('Diciembre de una panadería (sintético)', () => {
    const bills = [
      ...['2026-06', '2026-07', '2026-08', '2026-09'].map((m, i) => billWithDaily(`hs_${i}`, m, 55)),
      billWithDaily('hs_oct', '2026-10', 56),
      billWithDaily('hs_nov', '2026-11', 70),
    ];
    const r = measure(bills, '2026-10-10');
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.reasons).toEqual(['HIGH_SEASON']);
  });

  it('otro rubro no tiene temporada alta configurada', () => {
    const bills = [
      ...['2026-06', '2026-07', '2026-08', '2026-09'].map((m, i) => billWithDaily(`o_${i}`, m, 55)),
      billWithDaily('o_oct', '2026-10', 56),
      billWithDaily('o_nov', '2026-11', 70),
    ];
    expect(measure(bills, '2026-10-10', { ciiu: '5610' }).reasons).not.toContain('HIGH_SEASON');
  });
});

describe('Banda de ruido propia del negocio', () => {
  it('Variación de Inés', () => {
    const sigma = relativeSigmaPct(inesBills().map((b) => normalizeBill(b).kwhPerDay));
    expect(sigma).toBeCloseTo(2.57, 2);
    expect(noiseBandPct(sigma, 3, 1)).toBeCloseTo(5.94, 2);
    expect(noiseBandPct(sigma, 3, 2)).toBeCloseTo(4.69, 2);
  });

  it('usa 3 % con menos de cuatro facturas', () => {
    expect(relativeSigmaPct([58, 60, 59])).toBe(3);
    expect(noiseBandPct(3, 3, 2)).toBeCloseTo(5.48, 2);
  });
});

describe('Tres resultados posibles', () => {
  it('Solo agosto (sintético)', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul', 'ago'])]);
    expect(r.after?.kwhPerDay).toBeCloseTo(57.0968, 4);
    expect(r.changePct).toBeCloseTo(-3.06, 2);
    expect(r.bandPct).toBeCloseTo(5.94, 2);
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.reasons).toEqual(['WITHIN_NOISE']);
  });

  it('Agosto y septiembre (sintético)', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);
    expect(r.after?.days).toBe(61);
    expect(r.after?.kwhPerDay).toBeCloseTo(55.2459, 4);
    expect(r.changePct).toBeCloseTo(-6.21, 2);
    expect(r.bandPct).toBeCloseTo(4.69, 2);
    expect(r.status).toBe('MEASURED');
    expect(r.reasons).toEqual([]);
  });

  it('Tres facturas sin cambio claro (sintético)', () => {
    const after = [
      monthlyBill('a8', '2026-08', 1800, 0.84),
      monthlyBill('a9', '2026-09', 1750, 0.84),
      monthlyBill('a10', '2026-10', 1810, 0.84),
    ];
    const r = measure([...inesBills(), ...simulatedBills(['jul']), ...after]);
    expect(Math.abs(r.changePct ?? 99)).toBeLessThan(r.bandPct ?? 0);
    expect(r.status).toBe('NO_SAVINGS_DETECTED');
  });

  it('una suba mayor que la banda tampoco es ahorro', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul']), monthlyBill('up', '2026-08', 2100, 0.84)]);
    expect(r.status).toBe('NO_SAVINGS_DETECTED');
  });
});

describe('Valorización a la tarifa vigente y efecto de la tarifa aparte', () => {
  it('Ahorro de Inés valorizado (sintético)', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);
    expect(r.savings?.kwhPerDay).toBeCloseTo(3.66, 2);
    expect(r.savings?.kwhPerMonth).toBeCloseTo(109.7, 1);
    expect(r.savings?.kwhInAfterPeriod).toBeCloseTo(222.97, 2);
    expect(r.savings?.tariffPerKwh).toBe(0.84);
    expect(r.savings?.amountPerMonthCents).toBe(9211);
    expect(r.savings?.rangePerMonthCents).toEqual([2244, 16_178]);
  });

  it('Efecto de la tarifa', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);
    expect(r.tariffChange?.fromDate).toBe('2026-01-01');
    expect(r.tariffChange?.fromTariff).toBe(0.78);
    expect(r.tariffChange?.toTariff).toBe(0.84);
    expect(r.tariffChange?.changePct).toBeCloseTo(7.69, 2);
  });
});

describe('Qué falta y cuándo', () => {
  it('Próxima factura', () => {
    const r = measure([...inesBills(), ...simulatedBills(['jul', 'ago'])]);
    expect(r.nextBillEta).toBe('2026-09-30');
  });
});

describe('Periodos atípicos', () => {
  it('Periodo corto', () => {
    const short: Bill = {
      id: 'corta',
      serviceType: 'electricity',
      kwhConsumed: 690,
      costPerKwh: 0.84,
      billingStartDate: '2026-08-01',
      billingEndDate: '2026-08-12',
    };
    const r = measure([...inesBills(), ...simulatedBills(['jul']), short]);
    expect(r.excluded).toContainEqual({ billId: 'corta', reason: 'PERIOD_TOO_SHORT' });
    expect(r.reasons).toEqual(['NO_AFTER_BILL']);
  });

  it('ignora las facturas de agua', () => {
    const water: Bill = { ...monthlyBill('agua', '2026-08', 30, 3.5), serviceType: 'water' };
    const r = measure([...inesBills(), ...simulatedBills(['jul']), water]);
    expect(r.excluded).toContainEqual({ billId: 'agua', reason: 'NOT_ELECTRICITY' });
  });
});

describe('Historial de consumo del recibo (método)', () => {
  it('Historial superpuesto con una factura', () => {
    const realAug2025 = monthlyBill('real_2025_08', '2025-08', 1700, 0.75);
    const r = measure([realAug2025, ...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])], IMPL, {
      history: INES_RECEIPT_HISTORY_2025.months,
    });
    expect(r.method).toBe('YEAR_OVER_YEAR');
    // Agosto con la factura real (1700) y septiembre con el estimado (1680): 3380 kWh en 61 días.
    expect(r.baseline?.kwhPerDay).toBeCloseTo(3380 / 61, 4);
    expect(r.labels).toContain('ESTIMATED_HISTORY');
    expect(r.labels).toContain('NO_GROWTH_ADJUSTMENT');
  });
});
