import type { Country, Currency, Equipment, OvenType } from '../types.js';
import { notImplemented } from '../not-implemented.js';
import { CIIU_OPTIONS, EQUIPMENT_OPTIONS, OVEN_OPTIONS } from './lists.js';

export type SuggestionSource = 'ai' | 'keywords';

export interface ProfileSuggestions {
  ciiu: { code: string; label: string } | null;
  equipment: Equipment[];
  ovenType: OvenType | null;
  budget: { amount: number; currency: Currency } | null;
  hoursPerWeek: number | null;
  source: SuggestionSource;
}

/**
 * Esquema JSON estricto de la respuesta del modelo (`response_format: json_schema`, `strict: true`).
 * Los enum son las listas cerradas: el modelo elige, no escribe.
 */
export const PROFILE_ASSIST_JSON_SCHEMA = {
  name: 'perfil_asistido',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['ciiu', 'equipment', 'ovenType', 'budgetAmount', 'hoursPerWeek'],
    properties: {
      ciiu: { type: ['string', 'null'], enum: [...CIIU_OPTIONS.map((o) => o.code), null] },
      equipment: { type: 'array', items: { type: 'string', enum: EQUIPMENT_OPTIONS.map((o) => o.value) } },
      ovenType: { type: ['string', 'null'], enum: [...OVEN_OPTIONS.map((o) => o.value), null] },
      budgetAmount: { type: ['number', 'null'], description: 'Solo si el monto está escrito en el texto.' },
      hoursPerWeek: {
        type: ['number', 'null'],
        description: 'Solo si las horas están escritas en el texto.',
      },
    },
  },
} as const;

/** `true` si el número aparece escrito con cifras en el texto («1200», «1.200», «1,200»). Palabras como «mil» no cuentan. */
export function numberAppearsInText(value: number, text: string): boolean {
  return notImplemented(`numberAppearsInText(${value}, ${text.length})`);
}

/**
 * Filtra la respuesta del modelo: solo valores de las listas cerradas y montos u horas que aparecen
 * en la descripción. Todo lo demás se descarta. Nunca lanza: una respuesta inválida da sugerencias vacías.
 */
export function sanitizeModelSuggestions(
  raw: unknown,
  description: string,
  country: Country,
): ProfileSuggestions {
  return notImplemented(`sanitizeModelSuggestions(${typeof raw}, ${description.length}, ${country})`);
}

/** Alternativa sin IA: sugerencias por palabras clave sobre la descripción. */
export function suggestByKeywords(description: string, country: Country): ProfileSuggestions {
  return notImplemented(`suggestByKeywords(${description.length}, ${country})`);
}
