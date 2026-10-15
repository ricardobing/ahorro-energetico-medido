import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canonicalJson, measureSavings, noiseBandPct, type Bill } from '../src/index.js';
import { INES_IMPLEMENTED_AT } from '@ppam/fixtures';
import { inesBills, simulatedBills } from './helpers.js';

const all = (): Bill[] => [...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])];
const measure = (bills: Bill[]) =>
  measureSavings({ bills, implementedAt: INES_IMPLEMENTED_AT, country: 'PE', ciiu: '1071' });

const NUM_RUNS = 1000;

describe('Recálculo determinista y versionado', () => {
  it('Mismos datos', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(all(), { minLength: all().length }), (shuffled) => {
        expect(canonicalJson(measure(shuffled))).toBe(canonicalJson(measure(all())));
      }),
      { numRuns: 200 },
    );
  });
});

describe('Cada día cuenta una vez', () => {
  it('Orden de carga', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(all(), { minLength: all().length }), (shuffled) => {
        expect(measure(shuffled)).toEqual(measure(all()));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('ninguna factura se usa dos veces ni en dos lugares', () => {
    fc.assert(
      fc.property(fc.subarray(all(), { minLength: 1 }), (bills) => {
        const r = measure(bills);
        const used = [
          ...(r.baseline?.billIds ?? []),
          ...(r.after?.billIds ?? []),
          ...r.excluded.map((e) => e.billId),
        ];
        expect(new Set(used).size).toBe(used.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('propiedades de la medición', () => {
  it('cambiar las tarifas no cambia los kWh ahorrados ni el porcentaje', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0.3, max: 2.5, noNaN: true }), {
          minLength: all().length,
          maxLength: all().length,
        }),
        (tariffs) => {
          const repriced = all().map((b, i) => ({ ...b, costPerKwh: Math.round(tariffs[i]! * 100) / 100 }));
          const a = measure(all());
          const b = measure(repriced);
          expect(b.changePct).toBeCloseTo(a.changePct ?? 0, 10);
          expect(b.savings?.kwhPerDay).toBeCloseTo(a.savings?.kwhPerDay ?? 0, 10);
          expect(b.status).toBe(a.status);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('la banda nunca es negativa', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.integer({ min: 1, max: 24 }),
        fc.integer({ min: 1, max: 24 }),
        (sigma, nRef, nAfter) => {
          expect(noiseBandPct(sigma, nRef, nAfter)).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('el rango del ahorro nunca empieza en negativo', () => {
    const r = measure(all());
    expect(r.savings?.rangePerMonthCents[0]).toBeGreaterThanOrEqual(0);
  });
});
