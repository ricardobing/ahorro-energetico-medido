import { describe, expect, it } from 'vitest';
import {
  billTotalCents,
  checkImplementedAt,
  co2EquivalentKg,
  findOverlap,
  firstMeasurableBillEta,
  isAtypical,
  isStalled,
  normalizeBill,
  validateBillInput,
} from '../src/index.js';
import { inesBills } from './helpers.js';

const today = '2026-07-10';
const ok = {
  serviceType: 'electricity' as const,
  kwhConsumed: 1690,
  costPerKwh: 0.78,
  billingStartDate: '2026-02-01',
  billingEndDate: '2026-02-28',
};

describe('validación de facturas (dominio)', () => {
  it('acepta la factura de febrero del anexo', () => {
    expect(validateBillInput(ok, { country: 'PE', today })).toEqual([]);
  });

  it('rechaza fechas invertidas con un mensaje que dice qué corregir', () => {
    const errors = validateBillInput(
      { ...ok, billingStartDate: '2026-03-31', billingEndDate: '2026-03-01' },
      { country: 'PE', today },
    );
    expect(errors).toContainEqual({
      field: 'billingStartDate',
      code: 'START_AFTER_END',
      message: 'La fecha de inicio tiene que ser anterior a la de cierre.',
    });
  });

  it('rechaza fechas futuras, periodos de más de 92 días y consumos imposibles', () => {
    const codes = (input: Partial<typeof ok>) =>
      validateBillInput({ ...ok, ...input }, { country: 'PE', today }).map((e) => e.code);
    expect(codes({ billingEndDate: '2026-07-20', billingStartDate: '2026-06-21' })).toContain('FUTURE_DATE');
    expect(codes({ billingStartDate: '2026-01-01', billingEndDate: '2026-04-30' })).toContain(
      'PERIOD_TOO_LONG',
    );
    expect(codes({ kwhConsumed: 0 })).toContain('KWH_NOT_POSITIVE');
    expect(codes({ kwhConsumed: 2_000_000 })).toContain('KWH_TOO_LARGE');
    expect(codes({ billingStartDate: '2026-02-30' })).toContain('INVALID_DATE');
  });

  it('indica el rango de tarifa aceptado para el país', () => {
    const [error] = validateBillInput({ ...ok, costPerKwh: 78 }, { country: 'PE', today });
    expect(error?.code).toBe('TARIFF_OUT_OF_RANGE');
    expect(error?.message).toContain('0.20');
    expect(error?.message).toContain('3.00');
  });

  it('encuentra la superposición solo en el mismo servicio', () => {
    const existing = inesBills();
    const candidate = { ...ok, billingStartDate: '2026-02-15', billingEndDate: '2026-03-14' };
    expect(findOverlap(candidate, existing)?.id).toBe('bill_ines_2026_02');
    expect(findOverlap({ ...candidate, serviceType: 'water' }, existing)).toBeNull();
    expect(findOverlap({ ...ok, id: 'bill_ines_2026_02' }, existing)).toBeNull();
  });

  it('marca como atípico un consumo 0,3 o 3 veces lejos de la mediana', () => {
    const previous = inesBills().map((b) => normalizeBill(b).kwhPerDay);
    expect(isAtypical(17_900 / 31, previous)).toBe(true);
    expect(isAtypical(10, previous)).toBe(true);
    expect(isAtypical(57.7, previous)).toBe(false);
    expect(isAtypical(500, [])).toBe(false);
  });

  it('calcula totalCost y co2Equivalent', () => {
    expect(billTotalCents(1690, 0.78)).toBe(131_820);
    expect(co2EquivalentKg(1690, 'PE')).toBeCloseTo(338, 6);
  });
});

describe('planes (dominio)', () => {
  it('un plan en progreso sin cambios hace 28 días o más está estancado', () => {
    expect(isStalled({ status: 'in_progress', lastStepChangeAt: '2026-04-12' }, today)).toBe(true);
    // Del 12 de junio al 10 de julio hay 28 días; del 13, 27.
    expect(isStalled({ status: 'in_progress', lastStepChangeAt: '2026-06-12' }, today)).toBe(true);
    expect(isStalled({ status: 'in_progress', lastStepChangeAt: '2026-06-13' }, today)).toBe(false);
    expect(isStalled({ status: 'paused', lastStepChangeAt: '2026-01-01' }, today)).toBe(false);
  });

  it('valida la fecha de implementación', () => {
    expect(checkImplementedAt(null, today)).toBe('REQUIRED');
    expect(checkImplementedAt('2026-02-30', today)).toBe('INVALID');
    expect(checkImplementedAt('2026-07-20', today)).toBe('FUTURE');
    expect(checkImplementedAt('2025-07-09', today)).toBe('TOO_OLD');
    expect(checkImplementedAt('2026-07-08', today)).toBe('OK');
  });

  it('estima el cierre de la primera factura que podrá medir el cambio', () => {
    expect(firstMeasurableBillEta(inesBills(), '2026-07-08')).toBe('2026-08-31');
    expect(firstMeasurableBillEta(inesBills(), '2026-06-30')).toBe('2026-07-31');
  });
});
