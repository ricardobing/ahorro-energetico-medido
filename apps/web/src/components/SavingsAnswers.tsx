import type { ReactNode } from 'react';
import type { SavingsDisplay } from '@ppam/domain';

/**
 * «Tu ahorro» con la estructura «Tus tres preguntas»: ¿Bajó tu consumo? · ¿Cuánto es en soles? ·
 * ¿Por qué tu factura no baja igual? Recibe los textos ya armados por el dominio.
 */
export function SavingsAnswers(props: { display: SavingsDisplay }): ReactNode {
  throw new Error(`No implementado todavía: SavingsAnswers (${props.display.status})`);
}
