import { notImplemented } from './not-implemented.js';

/** Céntimos enteros de la moneda local. */
export type Cents = number;

/** Monto con decimales → céntimos enteros, redondeando la mitad hacia afuera. */
export function toCents(amount: number): Cents {
  return notImplemented(`toCents(${amount})`);
}

/** kWh × tarifa por kWh en céntimos exactos (sin errores de coma flotante). */
export function kwhTimesTariffCents(kwh: number, tariffPerKwh: number): Cents {
  return notImplemented(`kwhTimesTariffCents(${kwh}, ${tariffPerKwh})`);
}

/** Redondea al múltiplo de `stepCents` más cercano (por ejemplo, a S/ 5 o S/ 10). */
export function roundToStep(cents: Cents, stepCents: Cents): Cents {
  return notImplemented(`roundToStep(${cents}, ${stepCents})`);
}
