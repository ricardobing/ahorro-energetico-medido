import { noiseBandPct } from '../measurement/measure.js';
import { peerEffectPhrase } from '../privacy/index.js';
import { CIIU_OPTIONS, EQUIPMENT_OPTIONS } from '../profile/lists.js';
import {
  COUNTRY_PARAMS,
  MAX_COMPLEXITY_BY_LEVEL,
  MEASUREMENT_PARAMS,
  PRIVACY_PARAMS,
  RECOMMENDATION_PARAMS,
  RULESET_VERSION,
  TIME_RANGES_HOURS,
  type RecommendationParams,
} from '../params.js';
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
  const { min, max } = ranges[level];
  if (max !== null && max <= available) return 'FULL';
  if (min < available) return 'PARTIAL';
  return 'EXCLUDED';
}

const LEVEL_RANK: Record<Level, number> = { BAJA: 0, MEDIA: 1, ALTA: 2 };
const NOT_ELECTRIC_OVEN: OvenType[] = ['gas', 'diesel', 'none'];

/** Equipos declarados, más el horno eléctrico si lo dijo al elegir el tipo de horno. */
function declaredEquipment(business: BusinessForRecommendation): Set<Equipment> | null {
  if (business.equipment === null) return null;
  const declared = new Set<Equipment>(business.equipment);
  if (business.ovenType === 'electric') declared.add('electric_oven');
  if (NOT_ELECTRIC_OVEN.includes(business.ovenType)) declared.delete('electric_oven');
  return declared;
}

/** `true` si se sabe que el negocio no tiene ninguno de los equipos sobre los que actúa la ecoinnovación. */
function lacksEquipment(eco: CatalogEco, business: BusinessForRecommendation): boolean {
  const targets = eco.targetEquipment ?? [];
  if (targets.length === 0 || targets.includes('lighting')) return false;
  const declared = declaredEquipment(business);
  if (declared) return !targets.some((t) => declared.has(t));
  // Sin equipos declarados solo se sabe del horno, si dijo de qué tipo es.
  return targets.every((t) => t === 'electric_oven') && NOT_ELECTRIC_OVEN.includes(business.ovenType);
}

function targetedEquipment(eco: CatalogEco, business: BusinessForRecommendation): Equipment | null {
  const declared = declaredEquipment(business);
  if (!declared) return null;
  return (eco.targetEquipment ?? []).find((t) => declared.has(t)) ?? null;
}

const compareIds = (a: string, b: string) => (a < b ? -1 : 1);

export function recommend(input: RecommendationInput): RecommendationResult {
  const p: RecommendationParams = { ...RECOMMENDATION_PARAMS, ...input.params };
  const { business } = input;
  const investmentRanges = COUNTRY_PARAMS[business.country].investmentRangesCents;
  const maxComplexity = MAX_COMPLEXITY_BY_LEVEL[business.diagnosticLevel];
  // Un efecto se vería en la factura si supera la banda de ruido con 3 facturas antes y 2 después.
  const detectableFrom = noiseBandPct(
    input.sigmaPct ?? MEASUREMENT_PARAMS.defaultSigmaPct,
    p.detectabilityBefore,
    p.detectabilityAfter,
  );
  const peersById = new Map(input.peers.map((peer) => [peer.ecoId, peer]));
  const planEcos = new Set(input.plans.map((plan) => plan.ecoId));
  const budgetAndTimeKnown = business.budgetCents !== null && business.hoursPerWeek !== null;

  const ranked: (RankedEco & { eco: CatalogEco })[] = [];
  const excluded: RecommendationResult['excluded'] = [];

  for (const eco of input.catalog) {
    const exclusion: ExclusionCode[] = [];
    if (eco.category !== business.goalCategory) exclusion.push('GOAL_MISMATCH');
    if (eco.ciiuCodes.length > 0 && (business.ciiu === null || !eco.ciiuCodes.includes(business.ciiu)))
      exclusion.push('SECTOR_MISMATCH');
    if (lacksEquipment(eco, business)) exclusion.push('EQUIPMENT_MISSING');

    // Sin presupuesto declarado no se excluye por inversión, pero solo la baja se da por compatible.
    const budgetFit: LevelFit =
      business.budgetCents === null
        ? eco.investment === 'BAJA'
          ? 'FULL'
          : 'PARTIAL'
        : levelFit(eco.investment, investmentRanges, business.budgetCents);
    if (budgetFit === 'EXCLUDED') exclusion.push('BUDGET_EXCEEDED');
    const timeFit: LevelFit =
      business.hoursPerWeek === null ? 'FULL' : levelFit(eco.time, TIME_RANGES_HOURS, business.hoursPerWeek);
    if (timeFit === 'EXCLUDED') exclusion.push('TIME_EXCEEDED');
    if (LEVEL_RANK[eco.complexity] > LEVEL_RANK[maxComplexity]) exclusion.push('COMPLEXITY_ABOVE_LEVEL');
    if (planEcos.has(eco.id)) exclusion.push('PLAN_EXISTS');

    if (exclusion.length > 0) {
      excluded.push({ ecoId: eco.id, reasons: exclusion });
      continue;
    }

    const peer = peersById.get(eco.id);
    const chose = peer?.chose ?? 0;
    const completed = peer?.completed ?? 0;
    // Efecto en positivo (cuánto baja el consumo); la tabla de pares lo trae como cambio negativo.
    const peerEffect = peer && peer.medianChangePct !== null ? -peer.medianChangePct : null;
    const measured = peerEffect === null ? 0 : peer!.measuredCount;
    const pComplete =
      (completed + p.completionPrior * p.completionPriorWeight) / (chose + p.completionPriorWeight);
    const effectPct =
      (measured * (peerEffect ?? 0) + p.effectPriorPct * p.effectPriorWeight) /
      (measured + p.effectPriorWeight);
    const detectable = peerEffect !== null && peerEffect >= detectableFrom;
    const score =
      pComplete *
      effectPct *
      (budgetFit === 'PARTIAL' ? p.partialBudgetPenalty : 1) *
      (detectable ? 1 : p.undetectablePenalty);

    const reasons: ReasonCode[] = [];
    if (budgetFit === 'PARTIAL') reasons.push('MAY_EXCEED_BUDGET');
    else if (budgetAndTimeKnown && timeFit === 'FULL') reasons.push('FITS_BUDGET_AND_TIME');
    if (business.equipment === null) reasons.push('ASK_FOR_EQUIPMENT');
    else if (targetedEquipment(eco, business)) reasons.push('TARGETS_EQUIPMENT');
    if (chose >= PRIVACY_PARAMS.minBusinessesForNumber) reasons.push('PEERS_COMPLETED');
    if (measured >= PRIVACY_PARAMS.minBusinessesForNumber) reasons.push('PEERS_EFFECT');

    ranked.push({
      ecoId: eco.id,
      score,
      factors: { pComplete, effectPct, detectable, budgetFit, timeFit },
      reasons,
      eco,
    });
  }

  // Empates: primero la de menor complejidad, después menor inversión, menos tiempo y por último el id.
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      LEVEL_RANK[a.eco.complexity] - LEVEL_RANK[b.eco.complexity] ||
      LEVEL_RANK[a.eco.investment] - LEVEL_RANK[b.eco.investment] ||
      LEVEL_RANK[a.eco.time] - LEVEL_RANK[b.eco.time] ||
      compareIds(a.ecoId, b.ecoId),
  );

  return {
    rulesetVersion: RULESET_VERSION,
    chosenEcoId: ranked[0]?.ecoId ?? null,
    ranked: ranked.map(({ eco: _eco, ...rest }) => rest),
    excluded,
  };
}

export interface Explanation {
  /** Hasta tres motivos verdaderos, en orden. */
  reasons: string[];
  /** Lo que todavía no se sabe. */
  unknown: string;
}

const INVESTMENT_TEXT: Record<Level, string> = {
  BAJA: 'inversión baja',
  MEDIA: 'inversión media',
  ALTA: 'inversión alta',
};

const TIME_TEXT: Record<Level, string> = {
  BAJA: 'se hace en pocos días',
  MEDIA: 'te pide unas horas por semana',
  ALTA: 'te pide varias horas por semana',
};

/** Cómo se nombra a los negocios del mismo rubro («panaderías»), de la lista cerrada de CIIU. */
function sectorPlural(ciiu: string | null): string {
  return CIIU_OPTIONS.find((o) => o.code === ciiu)?.plural ?? 'negocios como el tuyo';
}

export function explainRecommendation(
  result: RecommendationResult,
  ctx: { catalog: CatalogEco[]; peers: PeerStat[]; business: BusinessForRecommendation; billsCount: number },
): Explanation {
  const unknown =
    ctx.billsCount > 0
      ? 'Todavía no sabemos cuánto te va a ahorrar a ti. Lo vamos a medir con tus próximas facturas de luz.'
      : 'Todavía no sabemos cuánto te va a ahorrar a ti. Para poder medirlo, sube tu última factura de luz.';
  const chosen = result.ranked.find((r) => r.ecoId === result.chosenEcoId);
  const eco = ctx.catalog.find((e) => e.id === result.chosenEcoId);
  if (!chosen || !eco) return { reasons: [], unknown };

  const peer = ctx.peers.find((p) => p.ecoId === eco.id);
  const sector = sectorPlural(ctx.business.ciiu);
  const reasons: string[] = [];
  for (const code of chosen.reasons) {
    switch (code) {
      case 'FITS_BUDGET_AND_TIME':
        reasons.push(
          `Cabe en tu presupuesto y en tus horas: ${INVESTMENT_TEXT[eco.investment]} y ${TIME_TEXT[eco.time]}.`,
        );
        break;
      case 'MAY_EXCEED_BUDGET':
        reasons.push(
          ctx.business.budgetCents === null
            ? `Es de ${INVESTMENT_TEXT[eco.investment]}: conviene cotizar antes de empezar.`
            : 'La inversión puede pasar tu presupuesto: conviene cotizar antes de empezar.',
        );
        break;
      case 'TARGETS_EQUIPMENT': {
        // El motivo solo existe si apunta a un equipo declarado, y todo equipo está en la lista cerrada.
        const target = targetedEquipment(eco, ctx.business)!;
        const name = EQUIPMENT_OPTIONS.find((o) => o.value === target)!.possessive;
        reasons.push(
          `Apunta a ${name}, que ${name.startsWith('tus ') ? 'gastan' : 'gasta'} buena parte de tu luz.`,
        );
        break;
      }
      case 'ASK_FOR_EQUIPMENT':
        reasons.push('Cuéntanos qué equipos usas para afinar la recomendación.');
        break;
      case 'PEERS_COMPLETED':
        reasons.push(`${peer!.completed} de cada ${peer!.chose} ${sector} que la eligieron la terminaron.`);
        break;
      case 'PEERS_EFFECT':
        // Con 5 o más negocios medidos la frase siempre lleva el número.
        reasons.push(peerEffectPhrase(peer!.measuredCount, peer!.medianChangePct, sector)!);
        break;
    }
  }
  return { reasons: reasons.slice(0, 3), unknown };
}
