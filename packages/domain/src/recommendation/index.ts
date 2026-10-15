import type { RecommendationParams } from '../params.js';
import type {
  CatalogEco,
  Country,
  DiagnosticLevel,
  Equipment,
  Level,
  OvenType,
  PeerStat,
  PlanStatus,
} from '../types.js';
import { notImplemented } from '../not-implemented.js';

export type LevelFit = 'FULL' | 'PARTIAL' | 'EXCLUDED';

export type ExclusionCode =
  | 'GOAL_MISMATCH'
  | 'SECTOR_MISMATCH'
  | 'EQUIPMENT_MISSING'
  | 'BUDGET_EXCEEDED'
  | 'TIME_EXCEEDED'
  | 'COMPLEXITY_ABOVE_LEVEL'
  | 'PLAN_EXISTS';

export type ReasonCode =
  /** Inversión y tiempo compatibles sin penalización. */
  | 'FITS_BUDGET_AND_TIME'
  /** Compatible, pero la inversión puede superar el presupuesto. */
  | 'MAY_EXCEED_BUDGET'
  /** Actúa sobre un equipo que el negocio declaró. */
  | 'TARGETS_EQUIPMENT'
  /** «X de cada Y … la terminaron» (solo con 5 o más elecciones). */
  | 'PEERS_COMPLETED'
  /** Mediana de cambio de pares (solo con 5 o más negocios medidos). */
  | 'PEERS_EFFECT'
  /** Faltan los equipos del negocio: se invita a contarlos. */
  | 'ASK_FOR_EQUIPMENT';

export interface BusinessForRecommendation {
  country: Country;
  ciiu: string | null;
  /** `null` = la usuaria todavía no contó qué equipos tiene. La iluminación se da por presente. */
  equipment: Equipment[] | null;
  ovenType: OvenType;
  diagnosticLevel: DiagnosticLevel;
  budgetCents: number | null;
  hoursPerWeek: number | null;
  /** Objetivo declarado: «pagar menos luz» = `ENERGY`. */
  goalCategory: string;
}

export interface RecommendationInput {
  business: BusinessForRecommendation;
  catalog: CatalogEco[];
  peers: PeerStat[];
  plans: { ecoId: string; status: PlanStatus }[];
  /** Variación propia del negocio en %, o `null` si tiene menos de 4 facturas (se usa la de por defecto). */
  sigmaPct: number | null;
  params?: Partial<RecommendationParams>;
}

export interface RankedEco {
  ecoId: string;
  /** P(completar) × efecto esperado (%) × penalizaciones. */
  score: number;
  factors: {
    pComplete: number;
    effectPct: number;
    detectable: boolean;
    budgetFit: LevelFit;
    timeFit: LevelFit;
  };
  reasons: ReasonCode[];
}

export interface RecommendationResult {
  rulesetVersion: string;
  chosenEcoId: string | null;
  ranked: RankedEco[];
  excluded: { ecoId: string; reasons: ExclusionCode[] }[];
}

/**
 * Compatibilidad de un nivel con lo disponible: FULL si el máximo del nivel no supera lo disponible,
 * PARTIAL si el mínimo es menor que lo disponible y el máximo lo supera, EXCLUDED si el mínimo lo iguala o supera.
 */
export function levelFit(
  level: Level,
  ranges: Record<Level, { min: number; max: number | null }>,
  available: number,
): LevelFit {
  return notImplemented(`levelFit(${level}, ${available})`);
}

export function recommend(input: RecommendationInput): RecommendationResult {
  return notImplemented(`recommend(${input.catalog.length} ecoinnovaciones)`);
}

export interface Explanation {
  /** Hasta tres motivos verdaderos, en orden. */
  reasons: string[];
  /** Lo que todavía no se sabe. */
  unknown: string;
}

export function explainRecommendation(
  result: RecommendationResult,
  ctx: { catalog: CatalogEco[]; peers: PeerStat[]; business: BusinessForRecommendation; billsCount: number },
): Explanation {
  return notImplemented(`explainRecommendation(${String(result.chosenEcoId)}, ${ctx.catalog.length})`);
}
