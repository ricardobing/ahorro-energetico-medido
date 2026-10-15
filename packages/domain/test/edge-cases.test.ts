import { describe, expect, it } from 'vitest';
import {
  addDays,
  billPeriodContaining,
  aggregateByEco,
  buildSavingsDisplay,
  canonicalJson,
  daysWithoutChange,
  explainRecommendation,
  findOverlap,
  firstMeasurableBillEta,
  isAtypical,
  measureSavings,
  median,
  peerEffectPhrase,
  projectBillEnd,
  recommend,
  relativeSigmaPct,
  roundToStep,
  sanitizeModelSuggestions,
  suggestByKeywords,
  suppressCells,
  toCents,
  validateBillInput,
  PROFILE_ASSIST_JSON_SCHEMA,
  type Bill,
  type BusinessForRecommendation,
  type CatalogEco,
  type MeasurementResult,
} from '../src/index.js';
import { INES_IMPLEMENTED_AT, monthlyBill } from '@ppam/fixtures';
import { billWithDaily, inesBills, plain, simulatedBills } from './helpers.js';

const ctx = { country: 'PE' as const, actionPhrase: 'cambiaste los burletes' };
const measure = (bills: Bill[], implementedAt: string | null = INES_IMPLEMENTED_AT, ciiu = '1071') =>
  measureSavings({ bills, implementedAt, country: 'PE', ciiu });
const show = (result: MeasurementResult) => {
  const d = buildSavingsDisplay(result, ctx);
  return { ...d, summary: plain(d.summary), tariffNote: plain(d.tariffNote), nextStep: plain(d.nextStep) };
};

describe('bordes de fechas, dinero y huella', () => {
  it('rechaza fechas y montos imposibles en vez de calcular mal', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(/Fecha inválida/);
    expect(() => toCents(Number.NaN)).toThrow(/Monto inválido/);
    expect(() => roundToStep(100, 0)).toThrow(/Paso inválido/);
    expect(toCents(-92.11)).toBe(-9211);
  });

  it('la huella ignora los campos sin valor', () => {
    expect(canonicalJson({ b: 1, a: undefined })).toBe('{"b":1}');
  });
});

describe('bordes de facturas', () => {
  const ok = {
    serviceType: 'electricity' as const,
    kwhConsumed: 1690,
    costPerKwh: 0.78,
    billingStartDate: '2026-02-01',
    billingEndDate: '2026-02-28',
  };

  it('marca la fecha de cierre inexistente y los números que no son números', () => {
    const errors = validateBillInput(
      { ...ok, billingEndDate: '2026-02-30', kwhConsumed: Number.NaN, costPerKwh: Number.NaN },
      { country: 'PE', today: '2026-07-10' },
    );
    expect(errors.map((e) => [e.field, e.code])).toEqual([
      ['billingEndDate', 'INVALID_DATE'],
      ['kwhConsumed', 'KWH_NOT_POSITIVE'],
      ['costPerKwh', 'TARIFF_OUT_OF_RANGE'],
    ]);
  });

  it('usa la mediana con cantidad par de facturas y no compara contra cero', () => {
    expect(isAtypical(100, [10, 20])).toBe(true);
    expect(isAtypical(5, [0, 0])).toBe(false);
  });

  it('la superposición sin id en la candidata compara contra todas', () => {
    const candidate = { ...ok, billingStartDate: '2026-01-20', billingEndDate: '2026-02-10' };
    expect(findOverlap(candidate, inesBills())?.id).toBe('bill_ines_2026_01');
  });
});

describe('bordes de planes y proyección de facturas', () => {
  const offset: Bill[] = [
    {
      ...monthlyBill('o3', '2026-03', 1700, 0.8),
      billingStartDate: '2026-03-15',
      billingEndDate: '2026-04-14',
    },
    {
      ...monthlyBill('o1', '2026-01', 1700, 0.8),
      billingStartDate: '2026-01-15',
      billingEndDate: '2026-02-14',
    },
    {
      ...monthlyBill('o2', '2026-02', 1700, 0.8),
      billingStartDate: '2026-02-15',
      billingEndDate: '2026-03-14',
    },
  ];

  it('cuenta los días sin cambios y nunca da negativo', () => {
    expect(daysWithoutChange({ status: 'in_progress', lastStepChangeAt: '2026-07-01' }, '2026-07-10')).toBe(
      9,
    );
    expect(daysWithoutChange({ status: 'in_progress', lastStepChangeAt: '2026-07-20' }, '2026-07-10')).toBe(
      0,
    );
  });

  it('proyecta periodos que no son meses calendario con la mediana de días', () => {
    expect(firstMeasurableBillEta(offset, '2026-04-20')).toBe('2026-06-15');
  });

  it('usa una factura que ya existe después del cambio', () => {
    expect(
      firstMeasurableBillEta([...inesBills(), ...simulatedBills(['jul', 'ago'])], INES_IMPLEMENTED_AT),
    ).toBe('2026-08-31');
  });

  it('sin facturas de luz o demasiado lejos no estima nada', () => {
    expect(projectBillEnd([], '2026-01-01')).toBeNull();
    expect(
      projectBillEnd([{ ...monthlyBill('agua', '2026-01', 30, 3), serviceType: 'water' }], '2026-01-01'),
    ).toBeNull();
    expect(projectBillEnd(inesBills(), '2040-01-01')).toBeNull();
  });
});

describe('bordes de la medición', () => {
  it('con consumos en cero usa la variación por defecto', () => {
    expect(relativeSigmaPct([0, 0, 0, 0])).toBe(3);
  });

  it('excluye un periodo de más de 40 días', () => {
    const long: Bill = { ...monthlyBill('larga', '2026-08', 2500, 0.84), billingEndDate: '2026-09-14' };
    const r = measure([...inesBills(), ...simulatedBills(['jul']), long]);
    expect(r.excluded).toContainEqual({ billId: 'larga', reason: 'PERIOD_TOO_LONG' });
  });

  it('sin facturas de luz ni fecha de cambio no hay nada que medir', () => {
    const r = measure([{ ...monthlyBill('agua', '2026-08', 30, 3.5), serviceType: 'water' }], null);
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.sigmaPct).toBe(3);
    expect(r.tariffChange).toBeNull();
  });

  it('una factura de agua del mismo mes no cambia el resultado', () => {
    const water: Bill = { ...monthlyBill('agua_ago', '2026-08', 30, 3.5), serviceType: 'water' };
    const withWater = measure([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep']), water]);
    const without = measure([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);
    expect(withWater.savings).toEqual(without.savings);
    expect(withWater.excluded).toContainEqual({ billId: 'agua_ago', reason: 'NOT_ELECTRICITY' });
  });

  it('periodos cercanos saltean la temporada alta al armar la comparación (sintético)', () => {
    const bills = [
      billWithDaily('ago25', '2025-08', 55),
      billWithDaily('sep25', '2025-09', 55),
      billWithDaily('oct25', '2025-10', 55),
      billWithDaily('nov25', '2025-11', 70),
      billWithDaily('dic25', '2025-12', 72),
      billWithDaily('ene26', '2026-01', 55),
      billWithDaily('feb26', '2026-02', 50),
    ];
    const r = measure(bills, '2026-01-10');
    expect(r.method).toBe('RECENT_PERIODS');
    expect(r.baseline?.billIds).toEqual(['ago25', 'sep25', 'oct25']);
    expect(r.excluded).toEqual(
      expect.arrayContaining([
        { billId: 'nov25', reason: 'HIGH_SEASON' },
        { billId: 'dic25', reason: 'HIGH_SEASON' },
      ]),
    );
  });

  it('el crecimiento se puede calcular con el historial del recibo (sintético)', () => {
    const bills = [
      billWithDaily('y25_ago', '2025-08', 50),
      billWithDaily('y25_sep', '2025-09', 50),
      ...['2026-04', '2026-05', '2026-06'].map((m, i) => billWithDaily(`y26_${i}`, m, 52.5)),
      billWithDaily('y26_jul', '2026-07', 51),
      billWithDaily('y26_ago', '2026-08', 50),
      billWithDaily('y26_sep', '2026-09', 50),
    ];
    const history = [
      { month: '2025-04', kwh: 1500 },
      { month: '2025-05', kwh: 1550 },
      { month: '2025-06', kwh: 1500 },
    ];
    const r = measureSavings({
      bills,
      history,
      implementedAt: INES_IMPLEMENTED_AT,
      country: 'PE',
      ciiu: '1071',
    });
    expect(r.method).toBe('YEAR_OVER_YEAR');
    expect(r.growthFactor).toBeCloseTo(1.05, 6);
    expect(r.labels).toEqual(['ESTIMATED_HISTORY']);
  });
});

describe('bordes de lo que ve la usuaria', () => {
  const withinNoise = () => measure([...inesBills(), ...simulatedBills(['jul', 'ago'])]);
  const measured = () => measure([...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])]);

  it('falta la primera factura después del cambio', () => {
    expect(show(measure([...inesBills(), ...simulatedBills(['jul'])])).summary).toBe(
      'Todavía no podemos saberlo. Falta tu primera factura completa después del cambio. Lo sabremos con tu factura que cierra alrededor del 31 de agosto.',
    );
  });

  it('faltan facturas de antes del cambio', () => {
    const june = inesBills().filter((b) => b.id === 'bill_ines_2026_06');
    expect(show(measure([...june, ...simulatedBills(['ago'])])).nextStep).toBe(
      'Sube tus facturas de los meses anteriores al cambio y comparamos enseguida.',
    );
  });

  it('describe la tendencia sin exagerarla', () => {
    expect(show({ ...withinNoise(), changePct: 0.01 }).summary).toContain('Por ahora se ve parecido, pero');
    expect(show({ ...withinNoise(), changePct: 2 }).summary).toContain('Parece que subió un poco, pero');
    expect(show({ ...withinNoise(), nextBillEta: null }).nextStep).toBe(
      'Lo sabremos cuando subas tu próxima factura.',
    );
  });

  it('si el mínimo del rango redondea a cero dice «hasta»', () => {
    const r = measured();
    const d = show({ ...r, savings: { ...r.savings!, rangePerMonthCents: [300, 16_178] } });
    expect(plain(d.money?.rangeText)).toBe('Hasta S/ 160');
    expect(d.summary).toContain('(hasta S/ 160)');
  });

  it('la tarifa que baja también se explica aparte', () => {
    const bills = [...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])].map((b) => ({
      ...b,
      costPerKwh: b.id === 'bill_ines_2026_01' ? 0.9 : 0.8,
    }));
    expect(show(measure(bills)).tariffNote).toBe(
      'Tu tarifa bajó 11 % desde enero: por eso tu factura puede bajar aunque no cambies nada. Esa baja no la contamos como ahorro tuyo.',
    );
  });

  it('no menciona la tarifa si casi no cambió', () => {
    const bills = [...inesBills(), ...simulatedBills(['jul', 'ago', 'sep'])].map((b) => ({
      ...b,
      costPerKwh: b.id === 'bill_ines_2026_01' ? 0.8 : 0.802,
    }));
    expect(buildSavingsDisplay(measure(bills), ctx).tariffNote).toBeNull();
  });

  it('línea del método interanual con y sin ajuste por crecimiento', () => {
    const lastYear = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09'].map((m, i) =>
      billWithDaily(`y25_${i}`, m, 50),
    );
    const before = ['2026-04', '2026-05', '2026-06'].map((m, i) => billWithDaily(`y26_${i}`, m, 52.5));
    const after = ['2026-07', '2026-08', '2026-09'].map((m, i) => billWithDaily(`a26_${i}`, m, 50));
    expect(buildSavingsDisplay(measure([...lastYear, ...before, ...after]), ctx).methodLine).toBe(
      'Comparado con los mismos meses del año pasado. Ya descontamos lo que tu negocio venía creciendo.',
    );
    expect(buildSavingsDisplay(measure([...lastYear.slice(3), ...before, ...after]), ctx).methodLine).toBe(
      'Comparado con los mismos meses del año pasado. Todavía no podemos descontar si tu negocio creció.',
    );
  });
});

describe('bordes de privacidad', () => {
  it('una sola celda chica se oculta aunque no haya otra para complementar', () => {
    expect(suppressCells([{ key: 'a', businesses: 3, value: 3 }], true)).toEqual(['a']);
  });

  it('la mediana sin valores es un error, no un cero', () => {
    expect(() => median([])).toThrow();
  });

  it('frases de pares con género, suba y sin número', () => {
    expect(peerEffectPhrase(4, -6, 'restaurantes')).toBe('Algunos restaurantes ya la midieron.');
    expect(plain(peerEffectPhrase(6, 3, 'panaderías'))).toBe(
      'En 6 panaderías que la midieron, el consumo por día subió una mediana de 3 %.',
    );
    expect(peerEffectPhrase(6, null, 'panaderías')).toBe('Algunas panaderías ya la midieron.');
  });

  it('un negocio cuenta una vez por ecoinnovación', () => {
    const base = {
      ecoId: 'eco_x',
      combo: false,
      evidence: 'with_receipt' as const,
      method: 'RECENT_PERIODS' as const,
    };
    const { rows } = aggregateByEco([
      { ...base, businessId: 'n1', changePct: -3 },
      { ...base, businessId: 'n1', changePct: -5 },
      { ...base, businessId: 'n2', changePct: -4 },
    ]);
    expect(rows).toEqual([{ ecoId: 'eco_x', businesses: 2, visibility: 'HIDDEN', medianChangePct: null }]);
  });
});

describe('bordes del perfil asistido', () => {
  it('descarta formas inválidas y valores fuera de rango', () => {
    const s = sanitizeModelSuggestions(
      { ciiu: '1071', equipment: 'horno', ovenType: 'gas', budgetAmount: 0, hoursPerWeek: 200 },
      'pan con 200 horas y 0 soles',
      'PE',
    );
    expect(s).toMatchObject({ equipment: [], ovenType: 'gas', budget: null, hoursPerWeek: null });
  });

  it('palabras clave para otros hornos, montos con signo y horas en cero', () => {
    expect(suggestByKeywords('Pastelería con horno a petróleo, S/ 1.500 y 0 horas', 'PE')).toMatchObject({
      ovenType: 'diesel',
      budget: { amount: 1500, currency: 'PEN' },
      hoursPerWeek: null,
    });
    expect(suggestByKeywords('No tenemos horno, vendemos 1,200 soles por día', 'PE')).toMatchObject({
      ovenType: 'none',
      budget: { amount: 1200, currency: 'PEN' },
    });
    expect(suggestByKeywords('Tenemos horno eléctrico y horno a gas', 'BO').ovenType).toBeNull();
  });
});

describe('bordes de la recomendación', () => {
  const ines: BusinessForRecommendation = {
    country: 'PE',
    ciiu: '1071',
    equipment: ['electric_oven', 'refrigeration'],
    ovenType: 'electric',
    diagnosticLevel: 'Crecimiento',
    budgetCents: 120_000,
    hoursPerWeek: 4,
    goalCategory: 'ENERGY',
  };
  const eco = (id: string, over: Partial<CatalogEco> = {}): CatalogEco => ({
    id,
    title: id,
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
  });
  const run = (business: BusinessForRecommendation, catalog: CatalogEco[], peers = [] as never[]) => {
    const result = recommend({ business, catalog, peers, plans: [], sigmaPct: null });
    return {
      result,
      explanation: explainRecommendation(result, { catalog, peers, business, billsCount: 1 }),
    };
  };
  const horno = eco('horno', { targetEquipment: ['electric_oven'] });

  it('un horno a gas excluye lo que actúa sobre el horno eléctrico', () => {
    const gas = { ...ines, equipment: ['refrigeration', 'electric_oven'] as const, ovenType: 'gas' as const };
    expect(run({ ...gas, equipment: [...gas.equipment] }, [horno]).result.excluded[0]?.reasons).toEqual([
      'EQUIPMENT_MISSING',
    ]);
    expect(run({ ...ines, equipment: null, ovenType: 'gas' }, [horno]).result.excluded[0]?.reasons).toEqual([
      'EQUIPMENT_MISSING',
    ]);
    expect(
      run({ ...ines, equipment: [] }, [eco('luz', { targetEquipment: ['lighting'] })]).result.chosenEcoId,
    ).toBe('luz');
  });

  it('sin presupuesto ni horas no promete que cabe', () => {
    const { result, explanation } = run({ ...ines, budgetCents: null, hoursPerWeek: null }, [
      eco('media', { investment: 'MEDIA' }),
      eco('baja'),
    ]);
    expect(result.ranked.find((r) => r.ecoId === 'baja')?.reasons).not.toContain('FITS_BUDGET_AND_TIME');
    expect(result.ranked.find((r) => r.ecoId === 'media')?.factors.budgetFit).toBe('PARTIAL');
    const onlyMedia = run({ ...ines, budgetCents: null }, [eco('media', { investment: 'MEDIA' })]);
    expect(onlyMedia.explanation.reasons[0]).toBe(
      'Es de inversión media: conviene cotizar antes de empezar.',
    );
    expect(explanation.reasons).not.toContain('Cabe en tu presupuesto y en tus horas');
  });

  it('con presupuesto conocido avisa que la inversión puede pasarlo', () => {
    expect(run(ines, [eco('media', { investment: 'MEDIA' })]).explanation.reasons[0]).toBe(
      'La inversión puede pasar tu presupuesto: conviene cotizar antes de empezar.',
    );
  });

  it('horas que alcanzan a medias no se presentan como compatibles', () => {
    const { result } = run({ ...ines, hoursPerWeek: 3 }, [eco('media', { time: 'MEDIA' })]);
    expect(result.ranked[0]?.factors.timeFit).toBe('PARTIAL');
    expect(result.ranked[0]?.reasons).not.toContain('FITS_BUDGET_AND_TIME');
  });

  it('si todo queda excluido no hay elección ni motivos', () => {
    const { result, explanation } = run(ines, [eco('agua', { category: 'WATER' })]);
    expect(result.chosenEcoId).toBeNull();
    expect(explanation.reasons).toEqual([]);
  });

  it('nombra el equipo en singular y el rubro desconocido sin inventarlo', () => {
    const peers = [{ ecoId: 'horno', chose: 9, completed: 7, measuredCount: 5, medianChangePct: -4 }];
    const result = recommend({
      business: { ...ines, ciiu: null },
      catalog: [horno],
      peers,
      plans: [],
      sigmaPct: 2.5,
    });
    const e = explainRecommendation(result, {
      catalog: [horno],
      peers,
      business: { ...ines, ciiu: null },
      billsCount: 1,
    });
    expect(e.reasons.map((r) => plain(r))).toEqual([
      'Cabe en tu presupuesto y en tus horas: inversión baja y se hace en pocos días.',
      'Apunta a tu horno eléctrico, que gasta buena parte de tu luz.',
      '7 de cada 9 negocios como el tuyo que la eligieron la terminaron.',
    ]);
    expect(result.ranked[0]?.reasons).toContain('PEERS_EFFECT');
  });
});

describe('esquema de la respuesta del modelo', () => {
  it('es estricto: sin propiedades extra y con todas las claves obligatorias', () => {
    const { schema, strict } = PROFILE_ASSIST_JSON_SCHEMA;
    expect(strict).toBe(true);
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    expect(schema.properties.ciiu.enum).toContain('1071');
    expect(schema.properties.equipment.items.enum).toContain('refrigeration');
  });
});

describe('periodo que contiene una fecha', () => {
  it('usa la factura existente o la proyectada', () => {
    expect(billPeriodContaining(inesBills(), '2026-03-10')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
    expect(billPeriodContaining(inesBills(), INES_IMPLEMENTED_AT)).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
    expect(billPeriodContaining(inesBills(), '2025-12-15')).toBeNull();
    expect(billPeriodContaining([], '2026-07-08')).toBeNull();
    expect(billPeriodContaining(inesBills(), '2040-01-01')).toBeNull();
  });
});
