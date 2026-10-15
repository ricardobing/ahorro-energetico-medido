/** Céntimos enteros de la moneda local. */
export type Cents = number;

/** Monto con decimales → céntimos enteros, redondeando la mitad hacia afuera. */
export function toCents(amount: number): Cents {
  if (!Number.isFinite(amount)) throw new Error(`Monto inválido: ${amount}`);
  const cents = Math.round(Math.abs(amount) * 100 + 1e-9);
  return amount < 0 ? -cents : cents;
}

/**
 * kWh × tarifa por kWh en céntimos exactos: los kWh se llevan a Wh y la tarifa a millonésimas,
 * se multiplican como enteros y recién al final se divide y se redondea.
 */
export function kwhTimesTariffCents(kwh: number, tariffPerKwh: number): Cents {
  const wh = Math.round(kwh * 1000);
  const microTariff = Math.round(tariffPerKwh * 1_000_000);
  const raw = (wh * microTariff) / 10_000_000;
  return toCents(raw / 100);
}

/** Redondea al múltiplo de `stepCents` más cercano (por ejemplo, a S/ 5 o S/ 10). */
export function roundToStep(cents: Cents, stepCents: Cents): Cents {
  if (stepCents <= 0) throw new Error(`Paso inválido: ${stepCents}`);
  return Math.round(cents / stepCents) * stepCents;
}
