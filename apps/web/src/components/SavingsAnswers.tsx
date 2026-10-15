import type { ReactNode } from 'react';
import type { SavingsDisplay } from '@ppam/domain';
import { plainSpaces, Question } from './ui';

/** Lee los montos de los textos ya formateados («Entre S/ 20 y S/ 160» → 20 y 160). */
function amountsIn(text: string): number[] {
  return [...plainSpaces(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, '')));
}

/**
 * El rango dibujado: la franja de lo posible y una marca en lo más probable. Muestra la incertidumbre
 * como un ancho, no como una fórmula; con más facturas la franja se angosta. Tiene su texto equivalente.
 */
export function RangeTrack(props: { rangeText: string; mostLikelyText: string }) {
  const bounds = amountsIn(props.rangeText);
  const [lo, hi] = bounds.length >= 2 ? [bounds[0]!, bounds[1]!] : [0, bounds[0] ?? 0];
  const likely = amountsIn(props.mostLikelyText)[0] ?? (lo + hi) / 2;
  const max = Math.max(hi * 1.15, likely * 1.2, 1);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const likelyAmount = plainSpaces(props.mostLikelyText).replace(/^Lo más probable:\s*/, '');
  const label = `${plainSpaces(props.rangeText)}, lo más probable ${likelyAmount}`;
  const loText = plainSpaces(props.rangeText).match(/S\/\s?[\d,.]+|Bs\s?[\d,.]+/g) ?? [];
  return (
    <div className="range">
      <div className="range-track" role="img" aria-label={label}>
        <div className="range-line" />
        <div className="range-span" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
        <div className="range-mark" style={{ left: pct(likely) }} />
      </div>
      <div className="range-ticks num" aria-hidden="true">
        <span>{loText.length >= 2 ? loText[0] : 'desde 0'}</span>
        <strong>{props.mostLikelyText}</strong>
        <span>{loText.at(-1)}</span>
      </div>
    </div>
  );
}

/** La parte del resumen que explica el motivo, sin repetir el título ni el siguiente paso. */
function explanationOf(display: SavingsDisplay): string | null {
  let text = display.summary;
  if (text.startsWith(display.headline)) text = text.slice(display.headline.length).replace(/^[.:]\s*/, '');
  if (display.nextStep && text.endsWith(display.nextStep))
    text = text.slice(0, -display.nextStep.length).trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface SavingsDetail {
  /** kWh por día antes y después del cambio, para la línea de apoyo de la primera respuesta. */
  baselineKwhPerDay: number | null;
  afterKwhPerDay: number | null;
  /** Cambio en % (negativo = baja), para el dato resaltado en lima. */
  changePct: number | null;
  locale?: string;
}

/**
 * «Tu ahorro» con la estructura «Tus tres preguntas»: ¿Bajó tu consumo? · ¿Cuánto es en soles? ·
 * ¿Por qué tu factura no baja igual? Recibe los textos ya armados por el dominio, iguales al reporte y al correo.
 */
export function SavingsAnswers(props: { display: SavingsDisplay; detail?: SavingsDetail }): ReactNode {
  const { display, detail } = props;
  const measured = display.status === 'MEASURED' && display.money;
  const kwh = (v: number) =>
    new Intl.NumberFormat(detail?.locale ?? 'es-PE', { maximumFractionDigits: 1 }).format(v);
  const explanation = explanationOf(display);

  return (
    <div className="stack">
      <Question
        n={1}
        question="¿Bajó tu consumo?"
        answer={display.headline}
        tone={measured ? undefined : 'outline'}
      >
        {measured && detail?.changePct !== null && detail?.changePct !== undefined ? (
          <span className="key-fact num" aria-hidden="true">
            {Math.round(-detail.changePct)} % menos por día
          </span>
        ) : null}
        {measured && detail?.baselineKwhPerDay && detail.afterKwhPerDay ? (
          <p className="support num">
            Antes usabas {kwh(detail.baselineKwhPerDay)} kWh por día; ahora, {kwh(detail.afterKwhPerDay)}.
          </p>
        ) : null}
        {!measured && explanation ? <p className="support">{explanation}</p> : null}
      </Question>

      <Question
        n={2}
        question="¿Cuánto es en soles?"
        answer={
          measured
            ? display.money!.text
            : display.status === 'NO_SAVINGS_DETECTED'
              ? 'Todavía no hay ahorro para contar en soles'
              : (display.nextStep ?? 'Lo sabremos con tu próxima factura.')
        }
        answerSize={measured ? undefined : 'md'}
      >
        {measured ? (
          <RangeTrack rangeText={display.money!.rangeText} mostLikelyText={display.money!.mostLikelyText} />
        ) : display.status === 'NO_SAVINGS_DETECTED' && display.nextStep ? (
          <p className="support">{display.nextStep}</p>
        ) : null}
      </Question>

      <Question
        n={3}
        question="¿Por qué tu factura no baja igual?"
        answer={
          display.tariffHeadline ??
          (display.tariffNote ? 'Tu factura no depende solo de ti' : 'Tu tarifa casi no cambió')
        }
        answerSize="md"
        tone="peach"
      >
        <p className="support">
          {display.tariffNote ?? 'Lo que cambie en tu factura viene sobre todo de cuánta luz usas.'}
        </p>
      </Question>

      {display.methodLine ? <p className="method">{display.methodLine}</p> : null}
    </div>
  );
}
