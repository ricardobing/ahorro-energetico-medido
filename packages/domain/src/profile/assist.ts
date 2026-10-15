import { currencyForCountry } from '../format.js';
import type { Country, Currency, Equipment, OvenType } from '../types.js';
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

const MAX_HOURS_PER_WEEK = 168;
const NUMBER_TOKEN = /\d{1,3}(?:[.,]\d{3})+(?![\d.,]*\d)|\d+(?:[.,]\d+)?/g;

/** Valores posibles de un número escrito: «1.200» y «1,200» pueden ser mil doscientos o uno coma dos. */
function readingsOf(token: string): number[] {
  const readings = new Set<number>();
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(token)) readings.add(Number(token.replace(/[.,]/g, '')));
  readings.add(Number(token.replace(',', '.')));
  return [...readings].filter(Number.isFinite);
}

/** `true` si el número aparece escrito con cifras en el texto («1200», «1.200», «1,200»). Palabras como «mil» no cuentan. */
export function numberAppearsInText(value: number, text: string): boolean {
  for (const [token] of text.matchAll(NUMBER_TOKEN)) if (readingsOf(token).includes(value)) return true;
  return false;
}

/** Minúsculas y sin tildes, para comparar palabras clave. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasKeyword(normalizedText: string, keyword: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(keyword)}($|[^\\p{L}\\p{N}])`, 'u').test(
    normalizedText,
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function ciiuOption(code: unknown): ProfileSuggestions['ciiu'] {
  const option = CIIU_OPTIONS.find((o) => o.code === code);
  return option ? { code: option.code, label: option.label } : null;
}

/** Solo los equipos de la lista, sin repetir y en el orden de la lista. */
function equipmentFrom(values: unknown): Equipment[] {
  if (!Array.isArray(values)) return [];
  return EQUIPMENT_OPTIONS.map((o) => o.value).filter((v) => values.includes(v));
}

function ovenFrom(value: unknown): OvenType | null {
  return OVEN_OPTIONS.find((o) => o.value === value)?.value ?? null;
}

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Filtra la respuesta del modelo: solo valores de las listas cerradas y montos u horas que aparecen
 * en la descripción. Todo lo demás se descarta. Nunca lanza: una respuesta inválida da sugerencias vacías.
 */
export function sanitizeModelSuggestions(
  raw: unknown,
  description: string,
  country: Country,
): ProfileSuggestions {
  const empty: ProfileSuggestions = {
    ciiu: null,
    equipment: [],
    ovenType: null,
    budget: null,
    hoursPerWeek: null,
    source: 'ai',
  };
  if (!isRecord(raw)) return empty;
  const { budgetAmount, hoursPerWeek } = raw;
  return {
    ...empty,
    ciiu: ciiuOption(raw.ciiu),
    equipment: equipmentFrom(raw.equipment),
    ovenType: ovenFrom(raw.ovenType),
    budget:
      positive(budgetAmount) && numberAppearsInText(budgetAmount, description)
        ? { amount: budgetAmount, currency: currencyForCountry(country) }
        : null,
    hoursPerWeek:
      positive(hoursPerWeek) &&
      hoursPerWeek <= MAX_HOURS_PER_WEEK &&
      numberAppearsInText(hoursPerWeek, description)
        ? hoursPerWeek
        : null,
  };
}

const CURRENCY_WORDS = '(?:soles?|s\\/\\.?|bolivianos?|bs\\.?|lucas|pesos)';
const AMOUNT_AFTER = new RegExp(`(\\d[\\d.,]*)\\s*${CURRENCY_WORDS}`, 'u');
const AMOUNT_BEFORE = new RegExp(`${CURRENCY_WORDS}\\s*(\\d[\\d.,]*)`, 'u');
const HOURS = /(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?|h)(?![\p{L}])/u;

/** El primer valor razonable de un número escrito (agrupado en miles si corresponde). */
function firstReading(token: string): number | null {
  const clean = token.replace(/[.,]$/, '');
  const [value] = readingsOf(clean).sort((a, b) => b - a);
  return value !== undefined && value > 0 ? value : null;
}

/** Alternativa sin IA: sugerencias por palabras clave sobre la descripción. */
export function suggestByKeywords(description: string, country: Country): ProfileSuggestions {
  const text = normalize(description);

  let ciiu: ProfileSuggestions['ciiu'] = null;
  let bestHits = 0;
  for (const option of CIIU_OPTIONS) {
    const hits = option.keywords.filter((k) => hasKeyword(text, k)).length;
    if (hits > bestHits) {
      bestHits = hits;
      ciiu = { code: option.code, label: option.label };
    }
  }

  const equipment = EQUIPMENT_OPTIONS.filter((o) => o.keywords.some((k) => hasKeyword(text, k))).map(
    (o) => o.value,
  );

  const electric = equipment.includes('electric_oven');
  const gas = equipment.includes('gas_oven');
  let ovenType: OvenType | null = null;
  if (electric !== gas) ovenType = electric ? 'electric' : 'gas';
  else if (!electric && /horno (a|de) petroleo|horno a diesel/.test(text)) ovenType = 'diesel';
  else if (!electric && /(no tenemos|no tengo|sin) horno/.test(text)) ovenType = 'none';

  const amountToken = AMOUNT_AFTER.exec(text)?.[1] ?? AMOUNT_BEFORE.exec(text)?.[1];
  const amount = amountToken ? firstReading(amountToken) : null;
  const hoursToken = HOURS.exec(text)?.[1];
  const hours = hoursToken ? firstReading(hoursToken) : null;

  return {
    ciiu,
    equipment,
    ovenType,
    budget: amount ? { amount, currency: currencyForCountry(country) } : null,
    hoursPerWeek: hours !== null && hours <= MAX_HOURS_PER_WEEK ? hours : null,
    source: 'keywords',
  };
}
