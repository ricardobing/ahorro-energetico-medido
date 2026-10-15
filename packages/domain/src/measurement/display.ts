import {
  formatDayMonth,
  formatMoney,
  formatMonthName,
  formatPercentInt,
  currencyForCountry,
  localeForCountry,
} from '../format.js';
import { roundToStep } from '../money.js';
import { MEASUREMENT_PARAMS } from '../params.js';
import type { Country } from '../types.js';
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
  /** La misma respuesta en una línea corta para el título de la tarjeta («La tarifa subió 8 % desde enero»). */
  tariffHeadline?: string | null;
  /** Qué falta y cuándo se va a saber. */
  nextStep: string | null;
}

export interface DisplayContext {
  country: Country;
  /** Frase de la acción en pasado, para «Desde que …»: «cambiaste los burletes». */
  actionPhrase: string;
}

const NOT_YET = 'Todavía no podemos saberlo';
const NO_SAVINGS = 'Por ahora no vemos ahorro';

function methodLine(result: MeasurementResult): string | null {
  if (!result.method || !result.baseline) return null;
  if (result.method === 'RECENT_PERIODS') {
    const n = result.baseline.billIds.length;
    return `Comparado con tus ${n} meses antes del cambio. Todavía no podemos corregir por temporada.`;
  }
  const estimated = result.labels.includes('ESTIMATED_HISTORY')
    ? ' (datos aproximados del gráfico de tu recibo)'
    : '';
  const growth = result.labels.includes('NO_GROWTH_ADJUSTMENT')
    ? ' Todavía no podemos descontar si tu negocio creció.'
    : ' Ya descontamos lo que tu negocio venía creciendo.';
  return `Comparado con los mismos meses del año pasado${estimated}.${growth}`;
}

function tariffNote(result: MeasurementResult, locale: string): string | null {
  const change = result.tariffChange;
  if (!change) return null;
  const pct = Math.abs(change.changePct);
  if (Math.round(pct) === 0) return null;
  const since = formatMonthName(change.fromDate, locale);
  return change.changePct > 0
    ? `Tu tarifa subió ${formatPercentInt(pct)} desde ${since}: por eso tu factura puede subir aunque uses menos luz. Eso no depende de ti.`
    : `Tu tarifa bajó ${formatPercentInt(pct)} desde ${since}: por eso tu factura puede bajar aunque no cambies nada. Esa baja no la contamos como ahorro tuyo.`;
}

function tariffHeadline(result: MeasurementResult, locale: string): string | null {
  const change = result.tariffChange;
  if (!change || Math.round(Math.abs(change.changePct)) === 0) return null;
  const verb = change.changePct > 0 ? 'subió' : 'bajó';
  return `La tarifa ${verb} ${formatPercentInt(Math.abs(change.changePct))} desde ${formatMonthName(change.fromDate, locale)}`;
}

function whenWeKnow(result: MeasurementResult, locale: string): string {
  return result.nextBillEta
    ? `Lo sabremos con tu factura que cierra alrededor del ${formatDayMonth(result.nextBillEta, locale)}.`
    : 'Lo sabremos cuando subas tu próxima factura.';
}

export function buildSavingsDisplay(result: MeasurementResult, ctx: DisplayContext): SavingsDisplay {
  const locale = localeForCountry(ctx.country);
  const currency = currencyForCountry(ctx.country);
  const money = (cents: number, step: number) => formatMoney(roundToStep(cents, step), currency, locale);
  const base = {
    status: result.status,
    methodLine: methodLine(result),
    tariffNote: tariffNote(result, locale),
    tariffHeadline: tariffHeadline(result, locale),
  };

  if (result.status === 'MEASURED' && result.savings && result.changePct !== null) {
    const pct = formatPercentInt(-result.changePct);
    const amount = money(result.savings.amountPerMonthCents, MEASUREMENT_PARAMS.roundSavingsToCents);
    const [lo, hi] = result.savings.rangePerMonthCents;
    const loText = money(lo, MEASUREMENT_PARAMS.roundRangeToCents);
    const hiText = money(hi, MEASUREMENT_PARAMS.roundRangeToCents);
    const lowIsZero = roundToStep(lo, MEASUREMENT_PARAMS.roundRangeToCents) === 0;
    const range = lowIsZero ? `hasta ${hiText}` : `entre ${loText} y ${hiText}`;
    return {
      ...base,
      summary: `Desde que ${ctx.actionPhrase} usas ${pct} menos de luz por día. A la tarifa de hoy son unos ${amount} menos por mes (${range}).`,
      headline: `Sí: usas ${pct} menos luz por día`,
      money: {
        text: `Unos ${amount} menos por mes`,
        rangeText: range.charAt(0).toUpperCase() + range.slice(1),
        mostLikelyText: `Lo más probable: ${amount}`,
      },
      nextStep: null,
    };
  }

  if (result.status === 'NO_SAVINGS_DETECTED') {
    const rose = result.changePct !== null && result.bandPct !== null && result.changePct >= result.bandPct;
    const detail = rose
      ? `este periodo usaste ${formatPercentInt(result.changePct!)} más luz por día que antes del cambio.`
      : 'tu consumo por día sigue dentro de lo que varía normalmente en tu negocio.';
    return {
      ...base,
      summary: `${NO_SAVINGS}: ${detail}`,
      headline: NO_SAVINGS,
      money: null,
      nextStep:
        'Revisa con tu equipo si el cambio se sigue haciendo todos los días. Seguimos comparando con cada factura nueva.',
    };
  }

  const reason = result.reasons[0];
  let explanation: string;
  let nextStep: string;
  switch (reason) {
    case 'NO_IMPLEMENTATION_DATE':
      explanation = '';
      nextStep = 'Cuando termines tu primer paso, comparamos tus facturas de antes y de después.';
      break;
    case 'NO_AFTER_BILL':
      explanation = 'Falta tu primera factura completa después del cambio.';
      nextStep = whenWeKnow(result, locale);
      break;
    case 'NOT_ENOUGH_BASELINE':
      explanation = 'Necesitamos al menos 2 facturas de antes del cambio para comparar.';
      nextStep = 'Sube tus facturas de los meses anteriores al cambio y comparamos enseguida.';
      break;
    case 'HIGH_SEASON':
      explanation = '';
      nextStep = `En estos meses la campaña de fin de año sube el consumo, así que no sirven para comparar con meses normales. ${whenWeKnow(result, locale)}`;
      break;
    default: {
      const trend =
        result.changePct === null || Math.round(result.changePct * 10) === 0
          ? 'Por ahora se ve parecido'
          : result.changePct < 0
            ? 'Parece que bajó un poco'
            : 'Parece que subió un poco';
      explanation = `${trend}, pero todavía está dentro de lo que tu consumo varía de un mes a otro.`;
      nextStep = whenWeKnow(result, locale);
    }
  }
  return {
    ...base,
    summary: [`${NOT_YET}.`, explanation, nextStep].filter(Boolean).join(' '),
    headline: NOT_YET,
    money: null,
    nextStep,
  };
}
