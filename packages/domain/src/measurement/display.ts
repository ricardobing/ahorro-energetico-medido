import type { Country } from '../types.js';
import { notImplemented } from '../not-implemented.js';
import type { MeasurementResult } from './types.js';

/** Textos para la usuaria, iguales en la web, el correo y el reporte. Sin jerga técnica. */
export interface SavingsDisplay {
  status: MeasurementResult['status'];
  /** Frase completa para el reporte, el correo y lectores de pantalla. */
  summary: string;
  /** Respuesta a «¿Bajó tu consumo?». */
  headline: string;
  /** Respuesta a «¿Cuánto es en soles?» (solo cuando hay ahorro medido). */
  money: { text: string; rangeText: string; mostLikelyText: string } | null;
  /** Línea del método: con qué se comparó y qué no se pudo corregir. */
  methodLine: string | null;
  /** Respuesta a «¿Por qué tu factura no baja igual?» (efecto de la tarifa, aparte). */
  tariffNote: string | null;
  /** Qué falta y cuándo se va a saber. */
  nextStep: string | null;
}

export interface DisplayContext {
  country: Country;
  /** Frase de la acción en pasado, para «Desde que …»: «cambiaste los burletes». */
  actionPhrase: string;
}

export function buildSavingsDisplay(result: MeasurementResult, ctx: DisplayContext): SavingsDisplay {
  return notImplemented(`buildSavingsDisplay(${result.status}, ${ctx.country})`);
}
