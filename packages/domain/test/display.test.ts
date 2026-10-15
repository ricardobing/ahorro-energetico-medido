import { describe, expect, it } from 'vitest';
import { buildSavingsDisplay, measureSavings, type Bill, type MeasurementResult } from '../src/index.js';
import { INES_IMPLEMENTED_AT, INES_RECEIPT_HISTORY_2025, monthlyBill } from '@ppam/fixtures';
import { inesBills, plain, simulatedBills } from './helpers.js';

const ctx = { country: 'PE' as const, actionPhrase: 'cambiaste los burletes' };

function display(
  bills: Bill[],
  implementedAt: string | null = INES_IMPLEMENTED_AT,
  extra: Partial<Parameters<typeof measureSavings>[0]> = {},
) {
  const result: MeasurementResult = measureSavings({
    bills,
    implementedAt,
    country: 'PE',
    ciiu: '1071',
    ...extra,
  });
  const d = buildSavingsDisplay(result, ctx);
  return {
    ...d,
    summary: plain(d.summary),
    headline: plain(d.headline),
    methodLine: plain(d.methodLine),
    tariffNote: plain(d.tariffNote),
    tariffHeadline: plain(d.tariffHeadline),
    nextStep: plain(d.nextStep),
    money: d.money && {
      text: plain(d.money.text),
      rangeText: plain(d.money.rangeText),
      mostLikelyText: plain(d.money.mostLikelyText),
    },
  };
}

describe('Lo que ve la usuaria', () => {
  it('Resultado medido de Inés (sintético)', () => {
    const d = display([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);
    expect(d.summary).toBe(
      'Desde que cambiaste los burletes usas 6 % menos de luz por día. A la tarifa de hoy son unos S/ 90 menos por mes (entre S/ 20 y S/ 160).',
    );
    expect(d.headline).toBe('Sí: usas 6 % menos luz por día');
    expect(d.money).toEqual({
      text: 'Unos S/ 90 menos por mes',
      rangeText: 'Entre S/ 20 y S/ 160',
      mostLikelyText: 'Lo más probable: S/ 90',
    });
    expect(d.methodLine).toBe(
      'Comparado con tus 3 meses antes del cambio. Todavía no podemos corregir por temporada.',
    );
    expect(d.tariffNote).toBe(
      'Tu tarifa subió 8 % desde enero: por eso tu factura puede subir aunque uses menos luz. Eso no depende de ti.',
    );
    expect(plain(d.tariffHeadline)).toBe('La tarifa subió 8 % desde enero');
  });

  it('Todavía no (sintético)', () => {
    const d = display([...inesBills(), ...simulatedBills(['jul', 'ago'])]);
    expect(d.summary).toBe(
      'Todavía no podemos saberlo. Parece que bajó un poco, pero todavía está dentro de lo que tu consumo varía de un mes a otro. Lo sabremos con tu factura que cierra alrededor del 30 de septiembre.',
    );
    expect(d.headline).toBe('Todavía no podemos saberlo');
    expect(d.money).toBeNull();
    expect(d.nextStep).toBe('Lo sabremos con tu factura que cierra alrededor del 30 de septiembre.');
  });

  it('La resta simple ya no engaña', () => {
    const bills = inesBills();
    for (let i = 0; i < bills.length; i++) {
      const rotated = [...bills.slice(i), ...bills.slice(0, i)];
      const d = display(rotated, null);
      expect(d.status).not.toBe('MEASURED');
      for (const text of [d.summary, d.headline, d.nextStep, d.methodLine, d.tariffNote])
        expect(text).not.toMatch(/ahorraste/i);
    }
  });

  it('sin fecha de implementación explica qué falta', () => {
    const d = display(inesBills(), null);
    expect(d.headline).toBe('Todavía no podemos saberlo');
    expect(d.nextStep).toBe('Cuando termines tu primer paso, comparamos tus facturas de antes y de después.');
  });

  it('sin ahorro porque el consumo subió, lo dice con el número', () => {
    // 2100 kWh en 31 días = 67,74 por día, 15 % más que los 58,90 de antes del cambio.
    const d = display([...inesBills(), ...simulatedBills(['jul']), monthlyBill('up', '2026-08', 2100, 0.84)]);
    expect(d.status).toBe('NO_SAVINGS_DETECTED');
    expect(d.headline).toBe('Por ahora no vemos ahorro');
    expect(d.summary).toBe(
      'Por ahora no vemos ahorro: este periodo usaste 15 % más luz por día que antes del cambio.',
    );
    expect(d.money).toBeNull();
  });

  it('sin ahorro después de tres facturas parecidas a las de antes', () => {
    const after = [
      monthlyBill('a8', '2026-08', 1800, 0.84),
      monthlyBill('a9', '2026-09', 1750, 0.84),
      monthlyBill('a10', '2026-10', 1810, 0.84),
    ];
    const d = display([...inesBills(), ...simulatedBills(['jul']), ...after]);
    expect(d.summary).toBe(
      'Por ahora no vemos ahorro: tu consumo por día sigue dentro de lo que varía normalmente en tu negocio.',
    );
  });

  it('en temporada alta explica la campaña de fin de año', () => {
    const bills = [
      ...['2026-06', '2026-07', '2026-08', '2026-09'].map((m, i) => monthlyBill(`hs_${i}`, m, 1700, 0.84)),
      monthlyBill('hs_oct', '2026-10', 1750, 0.84),
      monthlyBill('hs_nov', '2026-11', 2100, 0.84),
    ];
    const d = display(bills, '2026-10-10');
    expect(d.nextStep).toContain('campaña de fin de año');
  });

  it('línea del método con historial estimado del recibo', () => {
    const d = display(
      [monthlyBill('r', '2025-08', 1700, 0.75), ...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])],
      INES_IMPLEMENTED_AT,
      {
        history: INES_RECEIPT_HISTORY_2025.months,
      },
    );
    expect(d.methodLine).toBe(
      'Comparado con los mismos meses del año pasado (datos aproximados del gráfico de tu recibo). Todavía no podemos descontar si tu negocio creció.',
    );
  });

  it('nunca usa jerga técnica', () => {
    const d = display([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);
    for (const text of [
      d.summary,
      d.headline,
      d.methodLine,
      d.tariffNote,
      d.nextStep,
      d.money?.rangeText ?? '',
    ]) {
      expect(text).not.toMatch(/desv[ií]o|l[ií]nea de base|significan|banda|sigma|σ|estad[ií]stic|kwh\/d/i);
    }
  });
});
