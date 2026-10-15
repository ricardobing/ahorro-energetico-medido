import type { Bill } from '../src/index.js';
import { INES_BILLS, INES_BILLS_SIMULATED, monthlyBill } from '@ppam/fixtures';

/** Espacio duro (U+00A0) y espacio fino duro (U+202F) que usan `Intl` y los porcentajes. */
const HARD_SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g');

/** Reemplaza el espacio duro de `Intl` y de los porcentajes por un espacio común, para comparar textos. */
export function plain(text: string | null | undefined): string {
  return (text ?? '').replace(HARD_SPACES, ' ');
}

/** Facturas del caso sin los campos de rotulado. */
export function inesBills(): Bill[] {
  return INES_BILLS.map(({ id, serviceType, kwhConsumed, costPerKwh, billingStartDate, billingEndDate }) => ({
    id,
    serviceType,
    kwhConsumed,
    costPerKwh,
    billingStartDate,
    billingEndDate,
  }));
}

/** Facturas sintéticas de la simulación (julio, agosto y septiembre de 2026). */
export function simulatedBills(months: ('jul' | 'ago' | 'sep')[]): Bill[] {
  const byMonth = { jul: 0, ago: 1, sep: 2 } as const;
  return months.map((m) => {
    const { id, serviceType, kwhConsumed, costPerKwh, billingStartDate, billingEndDate } =
      INES_BILLS_SIMULATED[byMonth[m]]!;
    return { id, serviceType, kwhConsumed, costPerKwh, billingStartDate, billingEndDate };
  });
}

/** Factura de mes calendario con un consumo por día dado (kWh = consumo por día × días). */
export function billWithDaily(id: string, month: string, kwhPerDay: number, tariff = 0.8): Bill {
  const base = monthlyBill(id, month, 0, tariff);
  const days = Number(base.billingEndDate.slice(8, 10));
  return { ...base, kwhConsumed: kwhPerDay * days };
}
