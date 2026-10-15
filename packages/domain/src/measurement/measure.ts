import type { Bill } from '../types.js';
import { notImplemented } from '../not-implemented.js';
import type { MeasurementInput, MeasurementResult } from './types.js';

/** Días y kWh por día de una factura. */
export function normalizeBill(bill: Bill): { days: number; kwhPerDay: number } {
  return notImplemented(`normalizeBill(${bill.id})`);
}

/**
 * Variación relativa (%) del consumo por día: desvío muestral / media de las facturas dadas.
 * Con menos de 4 facturas devuelve la variación por defecto (3 %).
 */
export function relativeSigmaPct(kwhPerDay: number[], defaultPct?: number): number {
  return notImplemented(`relativeSigmaPct(${kwhPerDay.length}, ${String(defaultPct)})`);
}

/** Banda de ruido en %: 2 × σ × √(1/nAntes + 1/nDespués). */
export function noiseBandPct(sigmaPct: number, nReference: number, nAfter: number): number {
  return notImplemented(`noiseBandPct(${sigmaPct}, ${nReference}, ${nAfter})`);
}

/**
 * Medición del ahorro (método 1.0.0). Función pura: los mismos datos dan siempre el mismo resultado,
 * sin importar el orden de las facturas.
 */
export function measureSavings(input: MeasurementInput): MeasurementResult {
  return notImplemented(`measureSavings(${input.bills.length} facturas)`);
}
