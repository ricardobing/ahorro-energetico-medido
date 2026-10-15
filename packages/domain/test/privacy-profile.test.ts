import { describe, expect, it } from 'vitest';
import {
  aggregateByEco,
  cellVisibility,
  median,
  numberAppearsInText,
  peerEffectPhrase,
  sanitizeModelSuggestions,
  suggestByKeywords,
  suppressCells,
  type Outcome,
} from '../src/index.js';
import { PROFILE_DESCRIPTIONS, SYNTHETIC_BAKERIES } from '@ppam/fixtures';
import { plain } from './helpers.js';

/** Resultados medidos de las panaderías sintéticas (que reproducen la tabla del caso). */
const outcomes: Outcome[] = SYNTHETIC_BAKERIES.flatMap((b) =>
  b.elections.flatMap((e) =>
    e.measured
      ? [
          {
            businessId: b.id,
            ecoId: e.ecoId,
            changePct: e.measured.changePct,
            combo: false,
            evidence: e.measured.evidence,
            method: 'RECENT_PERIODS' as const,
          },
        ]
      : [],
  ),
);

describe('Umbral de 5 negocios', () => {
  it('Panaderías por ecoinnovación', () => {
    const { rows } = aggregateByEco(outcomes);
    const byEco = Object.fromEntries(rows.map((r) => [r.ecoId, r]));
    expect(byEco['eco_033']).toEqual({
      ecoId: 'eco_033',
      businesses: 5,
      visibility: 'NUMBER',
      medianChangePct: -4,
    });
    expect(byEco['eco_118']).toEqual({
      ecoId: 'eco_118',
      businesses: 4,
      visibility: 'QUALITATIVE',
      medianChangePct: null,
    });
    expect(byEco['eco_204']).toEqual({
      ecoId: 'eco_204',
      businesses: 2,
      visibility: 'HIDDEN',
      medianChangePct: null,
    });
    expect(byEco['eco_071']).toEqual({
      ecoId: 'eco_071',
      businesses: 1,
      visibility: 'HIDDEN',
      medianChangePct: null,
    });
  });

  it('Supresión complementaria', () => {
    const cells = [
      { key: 'medido', businesses: 12, value: 12 },
      { key: 'sin_ahorro', businesses: 3, value: 3 },
      { key: 'todavia_no', businesses: 6, value: 6 },
      { key: 'sin_datos', businesses: 8, value: 8 },
    ];
    expect(suppressCells(cells, true).sort()).toEqual(['sin_ahorro', 'todavia_no']);
    expect(suppressCells(cells, false)).toEqual(['sin_ahorro']);
  });

  it('decide la visibilidad por cantidad de negocios', () => {
    expect(cellVisibility(5)).toBe('NUMBER');
    expect(cellVisibility(4)).toBe('QUALITATIVE');
    expect(cellVisibility(3)).toBe('QUALITATIVE');
    expect(cellVisibility(2)).toBe('HIDDEN');
    expect(median([-2, -3, -4, -5, -6])).toBe(-4);
    expect(median([-4, -5, -7, -8])).toBe(-6);
  });
});

describe('Datos de otros negocios para la usuaria', () => {
  it('El caso único nunca se muestra', () => {
    expect(peerEffectPhrase(1, -18, 'panaderías')).toBeNull();
    expect(peerEffectPhrase(2, -11, 'panaderías')).toBeNull();
  });

  it('Frase cualitativa', () => {
    expect(peerEffectPhrase(4, -6, 'panaderías')).toBe('Algunas panaderías ya la midieron.');
    expect(plain(peerEffectPhrase(5, -4, 'panaderías'))).toBe(
      'En 5 panaderías que la midieron, el consumo por día bajó una mediana de 4 %.',
    );
  });
});

describe('Combinaciones de ecoinnovaciones', () => {
  it('Dos ecoinnovaciones a la vez (sintético)', () => {
    const withCombo: Outcome[] = [
      ...outcomes,
      {
        businessId: 'pan_combo',
        ecoId: 'eco_118',
        changePct: -12,
        combo: true,
        evidence: 'with_receipt',
        method: 'RECENT_PERIODS',
      },
      {
        businessId: 'pan_combo',
        ecoId: 'eco_033',
        changePct: -12,
        combo: true,
        evidence: 'with_receipt',
        method: 'RECENT_PERIODS',
      },
    ];
    const { rows, combos } = aggregateByEco(withCombo);
    expect(combos).toBe(1);
    expect(rows.find((r) => r.ecoId === 'eco_118')?.businesses).toBe(4);
    expect(rows.find((r) => r.ecoId === 'eco_033')?.medianChangePct).toBe(-4);
  });
});

describe('Valores del perfil asistido verificados contra el texto', () => {
  const inesModelOutput = {
    ciiu: '1071',
    equipment: ['electric_oven', 'refrigeration'],
    ovenType: 'electric',
    budgetAmount: 1200,
    hoursPerWeek: 4,
  };

  it('acepta lo que el modelo leyó bien de la descripción de Inés', () => {
    expect(sanitizeModelSuggestions(inesModelOutput, PROFILE_DESCRIPTIONS.ines, 'PE')).toEqual({
      ciiu: { code: '1071', label: 'Elaboración de productos de panadería' },
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      budget: { amount: 1200, currency: 'PEN' },
      hoursPerWeek: 4,
      source: 'ai',
    });
  });

  it('Monto que no está en el texto', () => {
    const s = sanitizeModelSuggestions(
      { ...inesModelOutput, budgetAmount: 1500 },
      PROFILE_DESCRIPTIONS.ines,
      'PE',
    );
    expect(s.budget).toBeNull();
    expect(s.hoursPerWeek).toBe(4);
  });

  it('Descripción sin montos', () => {
    const s = sanitizeModelSuggestions(
      { ciiu: '5630', equipment: ['refrigeration'], ovenType: null, budgetAmount: 1000, hoursPerWeek: 5 },
      PROFILE_DESCRIPTIONS.sinMontos,
      'PE',
    );
    expect(s.budget).toBeNull();
    expect(s.hoursPerWeek).toBeNull();
    expect(s.ciiu?.code).toBe('5630');
  });

  it('Código fuera de la lista', () => {
    const s = sanitizeModelSuggestions(
      {
        ciiu: '9999',
        equipment: ['nave_espacial', 'refrigeration'],
        ovenType: 'plasma',
        budgetAmount: null,
        hoursPerWeek: null,
      },
      PROFILE_DESCRIPTIONS.ines,
      'PE',
    );
    expect(s.ciiu).toBeNull();
    expect(s.equipment).toEqual(['refrigeration']);
    expect(s.ovenType).toBeNull();
  });

  it('una respuesta que no es un objeto da sugerencias vacías sin lanzar', () => {
    expect(sanitizeModelSuggestions('texto libre', PROFILE_DESCRIPTIONS.ines, 'PE')).toEqual({
      ciiu: null,
      equipment: [],
      ovenType: null,
      budget: null,
      hoursPerWeek: null,
      source: 'ai',
    });
  });

  it('reconoce números escritos con cifras y no con palabras', () => {
    expect(numberAppearsInText(1200, 'unos 1200 soles')).toBe(true);
    expect(numberAppearsInText(1200, 'unos 1.200 soles')).toBe(true);
    expect(numberAppearsInText(1200, 'unos 1,200 soles')).toBe(true);
    expect(numberAppearsInText(1200, 'unos mil doscientos soles')).toBe(false);
    expect(numberAppearsInText(4, '4 horas por semana')).toBe(true);
    expect(numberAppearsInText(4, '14 horas por semana')).toBe(false);
  });
});

describe('Perfil asistido con alternativa sin IA', () => {
  it('Sin IA', () => {
    expect(suggestByKeywords(PROFILE_DESCRIPTIONS.ines, 'PE')).toEqual({
      ciiu: { code: '1071', label: 'Elaboración de productos de panadería' },
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      budget: { amount: 1200, currency: 'PEN' },
      hoursPerWeek: 4,
      source: 'keywords',
    });
  });

  it('entiende palabras sin tildes y sinónimos regionales', () => {
    const s = suggestByKeywords('Panaderia de barrio con una heladera y horno a gas', 'BO');
    expect(s.ciiu?.code).toBe('1071');
    expect(s.equipment).toEqual(['gas_oven', 'refrigeration']);
    expect(s.ovenType).toBe('gas');
  });
});
