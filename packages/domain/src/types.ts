/** Fecha sin hora, `AAAA-MM-DD`. Nunca se convierte a `Date` con zona horaria para calcular. */
export type IsoDate = string;
/** Mes calendario, `AAAA-MM`. */
export type IsoMonth = string;

export type Country = 'PE' | 'BO';
export type Currency = 'PEN' | 'BOB' | 'USD';
export type ServiceType = 'electricity' | 'water';
export type Level = 'BAJA' | 'MEDIA' | 'ALTA';
export type DiagnosticLevel = 'Inicial' | 'Crecimiento' | 'Consolidación' | 'Expansión' | 'Liderazgo';

export type Equipment =
  | 'electric_oven'
  | 'gas_oven'
  | 'refrigeration'
  | 'lighting'
  | 'electric_water_heater'
  | 'air_conditioning'
  | 'motors'
  | 'computers';

export type OvenType = 'electric' | 'gas' | 'diesel' | 'none' | 'unknown';

/** Estados del plan del anexo, más `paused` (decisión D21). */
export type PlanStatus = 'not_started' | 'to_define' | 'in_progress' | 'delayed' | 'completed' | 'paused';

/** Factura de un servicio, con los nombres de campo del anexo. */
export interface Bill {
  id: string;
  serviceType: ServiceType;
  kwhConsumed: number;
  costPerKwh: number;
  billingStartDate: IsoDate;
  billingEndDate: IsoDate;
}

/** Consumo mensual estimado del gráfico del recibo (no es una factura). */
export interface HistoryMonth {
  month: IsoMonth;
  kwh: number;
}

/** Ecoinnovación del catálogo (campos del anexo + `targetEquipment`, nuevo y opcional). */
export interface CatalogEco {
  id: string;
  title: string;
  category: string;
  complexity: Level;
  investment: Level;
  time: Level;
  collaborators: Level;
  impact: string;
  returnInvestment: string;
  steps: string[];
  ciiuCodes: string[];
  targetEquipment?: Equipment[];
}

/** Lo que se sabe de negocios similares para una ecoinnovación. `medianChangePct` negativo = baja de consumo. */
export interface PeerStat {
  ecoId: string;
  chose: number;
  completed: number;
  measuredCount: number;
  medianChangePct: number | null;
}

/** Datos de origen: lo que viene del caso del reto o lo que es sintético y va rotulado. */
export type DataSource = 'caso' | 'sintetico';
