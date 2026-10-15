import { notImplemented } from '../not-implemented.js';

export type CellVisibility = 'NUMBER' | 'QUALITATIVE' | 'HIDDEN';

/** Con 5 o más negocios: número; con 3 o 4: solo texto; con menos: nada. */
export function cellVisibility(businesses: number): CellVisibility {
  return notImplemented(`cellVisibility(${businesses})`);
}

export interface Cell {
  key: string;
  businesses: number;
  value: number;
}

/**
 * Oculta las celdas con menos de 5 negocios y, si una fila tiene total visible y queda una sola
 * celda oculta, oculta también la siguiente más chica para que no se deduzca restando.
 * Devuelve las claves ocultas.
 */
export function suppressCells(cells: Cell[], totalVisible: boolean): string[] {
  return notImplemented(`suppressCells(${cells.length}, ${totalVisible})`);
}

/** Mediana (para agregados ya filtrados por umbral). */
export function median(values: number[]): number {
  return notImplemented(`median(${values.length})`);
}

export interface Outcome {
  businessId: string;
  ecoId: string;
  changePct: number;
  /** Midió más de una ecoinnovación con periodos superpuestos. */
  combo: boolean;
  evidence: 'with_receipt' | 'declared';
  method: 'YEAR_OVER_YEAR' | 'RECENT_PERIODS';
}

export interface EcoAggregate {
  ecoId: string;
  businesses: number;
  visibility: CellVisibility;
  medianChangePct: number | null;
}

/** Agregados por ecoinnovación, sin combinaciones y con el umbral aplicado. */
export function aggregateByEco(outcomes: Outcome[]): { rows: EcoAggregate[]; combos: number } {
  return notImplemented(`aggregateByEco(${outcomes.length})`);
}

/** Frase para la usuaria sobre otros negocios (`null` = no se dice nada). */
export function peerEffectPhrase(
  measuredBusinesses: number,
  medianChangePct: number | null,
  sectorPlural: string,
): string | null {
  return notImplemented(
    `peerEffectPhrase(${measuredBusinesses}, ${String(medianChangePct)}, ${sectorPlural})`,
  );
}
