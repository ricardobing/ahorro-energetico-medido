import { formatPercentInt } from '../format.js';
import { PRIVACY_PARAMS } from '../params.js';

export type CellVisibility = 'NUMBER' | 'QUALITATIVE' | 'HIDDEN';

/** Con 5 o más negocios: número; con 3 o 4: solo texto; con menos: nada. */
export function cellVisibility(businesses: number): CellVisibility {
  if (businesses >= PRIVACY_PARAMS.minBusinessesForNumber) return 'NUMBER';
  if (businesses >= PRIVACY_PARAMS.minBusinessesForQualitative) return 'QUALITATIVE';
  return 'HIDDEN';
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
  const hidden = cells.filter((c) => c.businesses < PRIVACY_PARAMS.minBusinessesForNumber).map((c) => c.key);
  if (totalVisible && hidden.length === 1) {
    const next = cells
      .filter((c) => !hidden.includes(c.key))
      .sort((a, b) => a.businesses - b.businesses || (a.key < b.key ? -1 : 1))[0];
    if (next) hidden.push(next.key);
  }
  return hidden;
}

/** Mediana (para agregados ya filtrados por umbral). */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('La mediana necesita al menos un valor');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
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
  const combos = new Set(outcomes.filter((o) => o.combo).map((o) => o.businessId));
  const byEco = new Map<string, Map<string, number>>();
  for (const o of outcomes) {
    if (o.combo) continue;
    const perBusiness = byEco.get(o.ecoId) ?? new Map<string, number>();
    // Un negocio cuenta una vez por ecoinnovación: vale su medición más reciente (la última que llega).
    perBusiness.set(o.businessId, o.changePct);
    byEco.set(o.ecoId, perBusiness);
  }
  const rows = [...byEco.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ecoId, perBusiness]): EcoAggregate => {
      const businesses = perBusiness.size;
      const visibility = cellVisibility(businesses);
      return {
        ecoId,
        businesses,
        visibility,
        medianChangePct: visibility === 'NUMBER' ? median([...perBusiness.values()]) : null,
      };
    });
  return { rows, combos: combos.size };
}

/** «Algunas panaderías» / «Algunos restaurantes», según el género de la primera palabra. */
function some(sectorPlural: string): string {
  const first = sectorPlural.split(' ')[0]!;
  return /as$/.test(first) ? 'Algunas' : 'Algunos';
}

/** Frase para la usuaria sobre otros negocios (`null` = no se dice nada). */
export function peerEffectPhrase(
  measuredBusinesses: number,
  medianChangePct: number | null,
  sectorPlural: string,
): string | null {
  const visibility = cellVisibility(measuredBusinesses);
  if (visibility === 'HIDDEN') return null;
  if (visibility === 'QUALITATIVE' || medianChangePct === null || Math.round(medianChangePct) === 0)
    return `${some(sectorPlural)} ${sectorPlural} ya la midieron.`;
  const direction = medianChangePct < 0 ? 'bajó' : 'subió';
  return `En ${measuredBusinesses} ${sectorPlural} que la midieron, el consumo por día ${direction} una mediana de ${formatPercentInt(Math.abs(medianChangePct))}.`;
}
