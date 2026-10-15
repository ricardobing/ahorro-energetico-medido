import { describe, expect, it } from 'vitest';
import {
  CATALOG_CASE,
  CATALOG_SYNTHETIC,
  INES_BILLS,
  PEER_STATS_CASE,
  PEER_TOTALS_CASE,
  PLAN_552,
  SYNTHETIC_BAKERIES,
} from '../src/index.js';

const allElections = [
  ...SYNTHETIC_BAKERIES.flatMap((b) => b.elections),
  { ecoId: PLAN_552.ecoCardOrigin, status: PLAN_552.status, measured: undefined },
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

describe('datos del caso y sintéticos', () => {
  it('las facturas del caso dan los totales del PDF al redondear al sol', () => {
    for (const b of INES_BILLS) expect(Math.round(b.kwhConsumed * b.costPerKwh)).toBe(b.totalPdf);
  });

  it('las 22 panaderías sintéticas más Inés reproducen la tabla de negocios similares', () => {
    expect(SYNTHETIC_BAKERIES).toHaveLength(PEER_TOTALS_CASE.bakeries - 1);
    expect(allElections).toHaveLength(PEER_TOTALS_CASE.chose);
    for (const p of PEER_STATS_CASE) {
      const el = allElections.filter((e) => e.ecoId === p.ecoId);
      const measured = el.flatMap((e) => (e.measured ? [e.measured.changePct] : []));
      expect({
        eco: p.ecoId,
        chose: el.length,
        completed: el.filter((e) => e.status === 'completed').length,
        measured: measured.length,
        median: median(measured),
      }).toEqual({
        eco: p.ecoId,
        chose: p.chose,
        completed: p.completed,
        measured: p.measuredCount,
        median: p.medianChangePct,
      });
    }
  });

  it('todo dato sintético está rotulado como tal', () => {
    for (const b of SYNTHETIC_BAKERIES) expect(b.fuente).toBe('sintetico');
    for (const e of CATALOG_SYNTHETIC) expect(e.fuente).toBe('sintetico');
    for (const e of CATALOG_CASE) expect(e.fuente).toBe('caso');
  });
});
