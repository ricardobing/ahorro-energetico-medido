import { describe, expect, it } from 'vitest';
import {
  COUNTRY_PARAMS,
  TIME_RANGES_HOURS,
  explainRecommendation,
  levelFit,
  noiseBandPct,
  normalizeBill,
  ownVariationPct,
  recommend,
  relativeSigmaPct,
  type BusinessForRecommendation,
  type CatalogEco,
  type PeerStat,
  type RecommendationInput,
} from '../src/index.js';
import {
  CATALOG_CASE,
  CATALOG_SYNTHETIC,
  INES,
  INES_IMPLEMENTED_AT,
  NEW_BUSINESS,
  PEER_STATS_CASE,
} from '@ppam/fixtures';
import { billWithDaily, inesBills, simulatedBills } from './helpers.js';

const strip = <T extends { fuente?: unknown; sinteticos?: unknown }>({
  fuente: _f,
  sinteticos: _s,
  ...rest
}: T) => rest;
const catalog: CatalogEco[] = [...CATALOG_CASE, ...CATALOG_SYNTHETIC].map((e) => strip(e) as CatalogEco);
const peers: PeerStat[] = PEER_STATS_CASE.map((p) => strip(p) as PeerStat);

const ines: BusinessForRecommendation = {
  country: 'PE',
  ciiu: INES.ciiu,
  equipment: INES.equipment,
  ovenType: INES.ovenType,
  diagnosticLevel: INES.diagnostic.level,
  budgetCents: INES.constraints.budgetQuarterCents,
  hoursPerWeek: INES.constraints.hoursPerWeek,
  goalCategory: 'ENERGY',
};

const inesInput: RecommendationInput = {
  business: ines,
  catalog,
  peers,
  plans: [{ ecoId: 'eco_071', status: 'in_progress' }],
  sigmaPct: 2.5709,
};

/** Ecoinnovación de prueba, compatible con Inés salvo lo que se cambie. */
function eco(id: string, over: Partial<CatalogEco> = {}): CatalogEco {
  return {
    id,
    title: `Prueba ${id}`,
    category: 'ENERGY',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: '',
    returnInvestment: '',
    steps: [],
    ciiuCodes: [],
    targetEquipment: ['refrigeration'],
    ...over,
  };
}

const excludedReasons = (r: ReturnType<typeof recommend>, id: string) =>
  r.excluded.find((e) => e.ecoId === id)?.reasons ?? [];

describe('Exclusión por restricciones del negocio', () => {
  it('El aislamiento térmico queda excluido para Inés', () => {
    const r = recommend(inesInput);
    expect(r.ranked.map((x) => x.ecoId)).not.toContain('eco_071');
    expect(excludedReasons(r, 'eco_071')).toEqual(
      expect.arrayContaining(['BUDGET_EXCEEDED', 'COMPLEXITY_ABOVE_LEVEL', 'PLAN_EXISTS']),
    );
  });

  it('Equipo que el negocio no tiene', () => {
    expect(excludedReasons(recommend(inesInput), 'eco_090')).toContain('EQUIPMENT_MISSING');
  });

  it('Sector del catálogo', () => {
    const r = recommend({
      ...inesInput,
      catalog: [eco('todos', { ciiuCodes: [] }), eco('restaurantes', { ciiuCodes: ['5610'] })],
      peers: [],
    });
    expect(r.ranked.map((x) => x.ecoId)).toContain('todos');
    expect(excludedReasons(r, 'restaurantes')).toContain('SECTOR_MISMATCH');
  });

  it('Dato de equipo desconocido', () => {
    const { targetEquipment: _t, ...sinEquipo } = eco('sin_equipo');
    const r = recommend({ ...inesInput, catalog: [sinEquipo], peers: [] });
    const ranked = r.ranked.find((x) => x.ecoId === 'sin_equipo');
    expect(ranked).toBeDefined();
    expect(ranked?.reasons).not.toContain('TARGETS_EQUIPMENT');
  });

  it('las categorías que no son el objetivo quedan afuera', () => {
    expect(excludedReasons(recommend(inesInput), 'eco_302')).toContain('GOAL_MISMATCH');
  });
});

describe('Rangos de presupuesto y horas', () => {
  it('Inversión con los rangos de referencia de Perú (sintéticos)', () => {
    const ranges = COUNTRY_PARAMS.PE.investmentRangesCents;
    expect(levelFit('BAJA', ranges, 120_000)).toBe('FULL');
    expect(levelFit('MEDIA', ranges, 120_000)).toBe('PARTIAL');
    expect(levelFit('ALTA', ranges, 120_000)).toBe('EXCLUDED');
  });

  it('Horas por semana', () => {
    expect(levelFit('BAJA', TIME_RANGES_HOURS, 4)).toBe('FULL');
    expect(levelFit('MEDIA', TIME_RANGES_HOURS, 4)).toBe('FULL');
    expect(levelFit('ALTA', TIME_RANGES_HOURS, 4)).toBe('EXCLUDED');
  });
});

describe('Orden por probabilidad de completar y efecto contraído', () => {
  it('Orden para Inés con los datos del caso', () => {
    const r = recommend(inesInput);
    expect(r.ranked.map((x) => x.ecoId)).toEqual(['eco_118', 'eco_204', 'eco_033']);
    expect(r.ranked.map((x) => x.score)).toEqual([
      expect.closeTo(2.08, 2),
      expect.closeTo(1.8, 2),
      expect.closeTo(0.66, 2),
    ]);
    expect(r.chosenEcoId).toBe('eco_118');
    expect(r.rulesetVersion).toBe('1.0.0');
  });

  it('Un caso único no domina', () => {
    const r = recommend({
      ...inesInput,
      plans: [],
      catalog: [eco('unico'), eco('cuatro')],
      peers: [
        { ecoId: 'unico', chose: 2, completed: 1, measuredCount: 1, medianChangePct: -18 },
        { ecoId: 'cuatro', chose: 9, completed: 7, measuredCount: 4, medianChangePct: -6 },
      ],
    });
    expect(r.ranked.map((x) => [x.ecoId, Math.round(x.score * 100) / 100])).toEqual([
      ['cuatro', 2.08],
      ['unico', 1.61],
    ]);
  });

  it('Efecto que no se vería en la factura', () => {
    const led = recommend(inesInput).ranked.find((x) => x.ecoId === 'eco_033');
    expect(led?.factors.detectable).toBe(false);
    expect(led?.factors.budgetFit).toBe('PARTIAL');
    expect(led?.score).toBeCloseTo(led!.factors.pComplete * led!.factors.effectPct * 0.5 * 0.8, 10);
  });

  it('Variación propia sin el salto de un cambio', () => {
    const bills = [...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])];
    expect(ownVariationPct(bills, [INES_IMPLEMENTED_AT])).toBeCloseTo(2.57, 2);
    // Con todas las facturas del año, el ahorro real se habría leído como variación normal.
    expect(relativeSigmaPct(bills.map((b) => normalizeBill(b).kwhPerDay))).toBeCloseTo(4.24, 2);
  });

  it('usa el tramo posterior al cambio cuando ya tiene cuatro facturas', () => {
    const before = ['01', '02', '03', '04', '05', '06'].map((m, i) =>
      billWithDaily(`b${m}`, `2026-${m}`, [60, 61, 59, 60, 62, 58][i]!),
    );
    const after = ['08', '09', '10', '11'].map((m, i) =>
      billWithDaily(`a${m}`, `2026-${m}`, [50, 51, 49, 50][i]!),
    );
    const withChange = billWithDaily('b07', '2026-07', 57);
    expect(ownVariationPct([...after, withChange, ...before], ['2026-07-08'])).toBeCloseTo(
      relativeSigmaPct([50, 51, 49, 50]),
      10,
    );
  });

  it('sin un tramo de cuatro facturas no hay variación propia', () => {
    const three = ['01', '02', '03'].map((m) => billWithDaily(`c${m}`, `2026-${m}`, 60));
    expect(ownVariationPct(three, [])).toBeNull();
    expect(ownVariationPct([...three, billWithDaily('c04', '2026-04', 60)], ['2026-03-15'])).toBeNull();
  });

  it('Empate', () => {
    const same = { chose: 5, completed: 3, measuredCount: 2, medianChangePct: -8 };
    const r = recommend({
      ...inesInput,
      plans: [],
      catalog: [eco('b_media', { complexity: 'MEDIA' }), eco('c_baja'), eco('a_baja')],
      peers: ['b_media', 'c_baja', 'a_baja'].map((ecoId) => ({ ecoId, ...same })),
    });
    expect(r.ranked.map((x) => x.ecoId)).toEqual(['a_baja', 'c_baja', 'b_media']);
  });
});

describe('Explicación con motivos verdaderos', () => {
  const r = () => recommend(inesInput);
  const explain = () => explainRecommendation(r(), { catalog, peers, business: ines, billsCount: 6 });

  it('Explicación para Inés', () => {
    expect(explain()).toEqual({
      reasons: [
        'Cabe en tu presupuesto y en tus horas: inversión baja y se hace en pocos días.',
        'Apunta a tus refrigeradoras, que gastan buena parte de tu luz.',
        '7 de cada 9 panaderías que la eligieron la terminaron.',
      ],
      unknown:
        'Todavía no sabemos cuánto te va a ahorrar a ti. Lo vamos a medir con tus próximas facturas de luz.',
    });
  });

  it('Sin efecto de pares por debajo del umbral', () => {
    const e = explain();
    expect(e.reasons.join(' ')).not.toMatch(/6\s?%/);
    expect(r().ranked[0]?.reasons).not.toContain('PEERS_EFFECT');
  });

  it('Sin dinero inventado', () => {
    const e = explain();
    for (const text of [...e.reasons, e.unknown]) expect(text).not.toMatch(/S\/|soles|\$|\d+[.,]\d{2}/);
  });
});

describe('Recomendación sin facturas', () => {
  const nuevo: BusinessForRecommendation = {
    country: 'PE',
    ciiu: NEW_BUSINESS.ciiu,
    equipment: NEW_BUSINESS.equipment,
    ovenType: NEW_BUSINESS.ovenType,
    diagnosticLevel: NEW_BUSINESS.diagnostic.level,
    budgetCents: NEW_BUSINESS.constraints.budgetQuarterCents,
    hoursPerWeek: NEW_BUSINESS.constraints.hoursPerWeek,
    goalCategory: 'ENERGY',
  };

  it('Negocio nuevo con respuestas (sintético)', () => {
    const r = recommend({ business: nuevo, catalog, peers, plans: [], sigmaPct: null });
    expect(r.chosenEcoId).toBe('eco_118');
    expect(noiseBandPct(3, 3, 2)).toBeCloseTo(5.48, 2);
    expect(r.ranked.find((x) => x.ecoId === 'eco_033')?.factors.detectable).toBe(false);
    const e = explainRecommendation(r, { catalog, peers, business: nuevo, billsCount: 0 });
    expect(e.unknown).toBe(
      'Todavía no sabemos cuánto te va a ahorrar a ti. Para poder medirlo, sube tu última factura de luz.',
    );
  });

  it('Negocio nuevo sin respuestas', () => {
    const sinDatos = { ...nuevo, equipment: null, ovenType: 'unknown' as const };
    const r = recommend({ business: sinDatos, catalog, peers, plans: [], sigmaPct: null });
    expect(r.chosenEcoId).not.toBeNull();
    expect(r.ranked[0]?.reasons).toContain('ASK_FOR_EQUIPMENT');
    expect(r.ranked[0]?.reasons).not.toContain('TARGETS_EQUIPMENT');
    const e = explainRecommendation(r, { catalog, peers, business: sinDatos, billsCount: 0 });
    expect(e.reasons).toContain('Cuéntanos qué equipos usas para afinar la recomendación.');
  });
});
