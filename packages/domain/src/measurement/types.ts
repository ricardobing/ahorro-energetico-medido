import type { MeasurementParams } from '../params.js';
import type { Cents } from '../money.js';
import type { Bill, Country, HistoryMonth, IsoDate } from '../types.js';

export type MeasurementStatus = 'MEASURED' | 'INSUFFICIENT_DATA' | 'NO_SAVINGS_DETECTED';

export type InsufficientReason =
  'NO_IMPLEMENTATION_DATE' | 'NO_AFTER_BILL' | 'NOT_ENOUGH_BASELINE' | 'WITHIN_NOISE' | 'HIGH_SEASON';

export type MeasurementMethod = 'YEAR_OVER_YEAR' | 'RECENT_PERIODS';

export type MeasurementLabel =
  /** Periodos cercanos: no se puede corregir por temporada. */
  | 'NO_SEASONAL_ADJUSTMENT'
  /** Interanual sin pares previos para descontar el crecimiento del negocio. */
  | 'NO_GROWTH_ADJUSTMENT'
  /** Se usó historial estimado del gráfico del recibo. */
  | 'ESTIMATED_HISTORY';

export type ExclusionReason =
  'CONTAINS_IMPLEMENTATION_DATE' | 'PERIOD_TOO_SHORT' | 'PERIOD_TOO_LONG' | 'NOT_ELECTRICITY';

export interface MeasurementInput {
  /** Facturas vigentes (sin borradas) del negocio. Se usan solo las de luz. */
  bills: Bill[];
  /** Consumo mensual estimado del gráfico del recibo, si la usuaria lo cargó. */
  history?: HistoryMonth[];
  implementedAt: IsoDate | null;
  country: Country;
  /** CIIU del negocio, para la temporada alta del rubro. */
  ciiu?: string | null;
  params?: Partial<MeasurementParams>;
}

export interface PeriodSummary {
  /** kWh por día ponderado por días. */
  kwhPerDay: number;
  days: number;
  billIds: string[];
}

export interface Savings {
  /** kWh por día menos que la referencia. */
  kwhPerDay: number;
  /** kWh ahorrados en todo el periodo posterior medido. */
  kwhInAfterPeriod: number;
  /** kWh por mes equivalente (30 días). */
  kwhPerMonth: number;
  /** Tarifa del periodo posterior más reciente. */
  tariffPerKwh: number;
  amountPerMonthCents: Cents;
  /** Rango del ahorro mensual según la banda de ruido (el mínimo nunca es negativo). */
  rangePerMonthCents: [Cents, Cents];
}

export interface TariffChange {
  /** Inicio de la factura más antigua de los últimos 12 meses. */
  fromDate: IsoDate;
  fromTariff: number;
  toTariff: number;
  changePct: number;
}

export interface MeasurementResult {
  methodVersion: string;
  status: MeasurementStatus;
  reasons: InsufficientReason[];
  method: MeasurementMethod | null;
  labels: MeasurementLabel[];
  /** Variación relativa propia del negocio (o la de por defecto), en %. */
  sigmaPct: number;
  bandPct: number | null;
  /** Cambio del consumo por día contra la referencia, en % (negativo = baja). */
  changePct: number | null;
  /** Factor de tendencia del método interanual (1 = sin ajuste). */
  growthFactor: number | null;
  baseline: PeriodSummary | null;
  after: PeriodSummary | null;
  savings: Savings | null;
  tariffChange: TariffChange | null;
  excluded: { billId: string; reason: ExclusionReason }[];
  /** Cierre estimado de la próxima factura, cuando falta información. */
  nextBillEta: IsoDate | null;
}
