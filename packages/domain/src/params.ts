import type { Country, Currency, DiagnosticLevel, Level } from './types.js';

export const RULESET_VERSION = '1.0.0';
export const METHOD_VERSION = '1.0.0';

/** Rango de un nivel BAJA/MEDIA/ALTA: `min` exclusivo, `max` inclusivo (`null` = sin tope). */
export interface LevelRange {
  min: number;
  max: number | null;
}

export interface CountryParams {
  currency: Currency;
  locale: string;
  /** Rangos de inversión en céntimos de la moneda local (sintéticos, a calibrar con Agora). */
  investmentRangesCents: Record<Level, LevelRange>;
  /** Tarifa aceptada por kWh en la moneda local. */
  tariffRange: { min: number; max: number };
  /** Factor de emisión, kg de CO₂e por kWh. Valor sintético: se reemplaza por el que usa Kamai en `co2Equivalent`. */
  co2KgPerKwh: number;
}

export const COUNTRY_PARAMS: Record<Country, CountryParams> = {
  PE: {
    currency: 'PEN',
    locale: 'es-PE',
    investmentRangesCents: {
      BAJA: { min: 0, max: 50_000 },
      MEDIA: { min: 50_000, max: 200_000 },
      ALTA: { min: 200_000, max: null },
    },
    tariffRange: { min: 0.2, max: 3 },
    co2KgPerKwh: 0.2,
  },
  BO: {
    currency: 'BOB',
    locale: 'es-BO',
    investmentRangesCents: {
      BAJA: { min: 0, max: 350_000 },
      MEDIA: { min: 350_000, max: 1_400_000 },
      ALTA: { min: 1_400_000, max: null },
    },
    tariffRange: { min: 0.3, max: 5 },
    co2KgPerKwh: 0.4,
  },
};

/** Horas por semana por nivel de tiempo del catálogo. */
export const TIME_RANGES_HOURS: Record<Level, LevelRange> = {
  BAJA: { min: 0, max: 2 },
  MEDIA: { min: 2, max: 4 },
  ALTA: { min: 4, max: null },
};

/** Complejidad máxima admitida por nivel de diagnóstico. */
export const MAX_COMPLEXITY_BY_LEVEL: Record<DiagnosticLevel, Level> = {
  Inicial: 'BAJA',
  Crecimiento: 'MEDIA',
  Consolidación: 'ALTA',
  Expansión: 'ALTA',
  Liderazgo: 'ALTA',
};

export interface RecommendationParams {
  completionPrior: number;
  completionPriorWeight: number;
  effectPriorPct: number;
  effectPriorWeight: number;
  partialBudgetPenalty: number;
  undetectablePenalty: number;
  /** Facturas antes y después con las que se evalúa si el efecto se vería (3 y 2). */
  detectabilityBefore: number;
  detectabilityAfter: number;
}

export const RECOMMENDATION_PARAMS: RecommendationParams = {
  completionPrior: 0.3,
  completionPriorWeight: 5,
  effectPriorPct: 0,
  effectPriorWeight: 3,
  partialBudgetPenalty: 0.8,
  undetectablePenalty: 0.5,
  detectabilityBefore: 3,
  detectabilityAfter: 2,
};

export interface MeasurementParams {
  minPeriodDays: number;
  maxPeriodDays: number;
  baselineBills: number;
  minBaselineBills: number;
  yoyMinCoverage: number;
  minGrowthPairs: number;
  defaultSigmaPct: number;
  minBillsForOwnSigma: number;
  bandMultiplier: number;
  noSavingsAfterBills: number;
  highSeasonMinOverlapDays: number;
  /** Meses de temporada alta por CIIU (1 = enero). */
  highSeasonMonthsByCiiu: Record<string, number[]>;
  roundSavingsToCents: number;
  roundRangeToCents: number;
  daysPerMonth: number;
}

export const MEASUREMENT_PARAMS: MeasurementParams = {
  minPeriodDays: 20,
  maxPeriodDays: 40,
  baselineBills: 3,
  minBaselineBills: 2,
  yoyMinCoverage: 0.8,
  minGrowthPairs: 2,
  defaultSigmaPct: 3,
  minBillsForOwnSigma: 4,
  bandMultiplier: 2,
  noSavingsAfterBills: 3,
  highSeasonMinOverlapDays: 7,
  highSeasonMonthsByCiiu: { '1071': [11, 12] },
  roundSavingsToCents: 500,
  roundRangeToCents: 1000,
  daysPerMonth: 30,
};

export const BILL_PARAMS = {
  maxPeriodDays: 92,
  maxKwh: 1_000_000,
  atypicalLow: 0.3,
  atypicalHigh: 3,
  maxPhotos: 2,
  maxPhotoBytes: 5 * 1024 * 1024,
  allowedPhotoTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export const PLAN_PARAMS = {
  stalledAfterDays: 28,
  implementedAtMaxAgeDays: 365,
} as const;

export const PRIVACY_PARAMS = {
  minBusinessesForNumber: 5,
  minBusinessesForQualitative: 3,
} as const;

export const PROFILE_ASSIST_PARAMS = {
  timeoutMs: 10_000,
  maxRequestsPerDay: 20,
} as const;
