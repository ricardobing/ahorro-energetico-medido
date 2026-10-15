import OpenAI from 'openai';
import { CIIU_OPTIONS, EQUIPMENT_OPTIONS, OVEN_OPTIONS, PROFILE_ASSIST_JSON_SCHEMA } from '@ppam/domain';
import type { AiConfig } from '../config.js';
import { ServiceError, type ProfileModel } from './types.js';

/** Instrucciones del perfil asistido: elegir de listas cerradas y no inventar montos. */
export const PROFILE_SYSTEM_PROMPT = [
  'Completas el perfil de una mipyme de Latinoamérica a partir de lo que escribe su dueña.',
  'Devuelves solo el JSON del esquema. Para el rubro (CIIU), los equipos y el tipo de horno eliges únicamente valores de las listas; si el texto no lo dice, devuelves null o una lista vacía.',
  'budgetAmount y hoursPerWeek solo si el número está escrito en el texto, tal cual. Nunca estimes ni conviertas montos.',
  '',
  'Rubros (código: descripción):',
  ...CIIU_OPTIONS.map((o) => `- ${o.code}: ${o.label}`),
  '',
  'Equipos (valor: descripción):',
  ...EQUIPMENT_OPTIONS.map((o) => `- ${o.value}: ${o.label}`),
  '',
  'Tipos de horno (valor: descripción):',
  ...OVEN_OPTIONS.map((o) => `- ${o.value}: ${o.label}`),
].join('\n');

/**
 * Adaptador del perfil asistido con el SDK oficial de OpenAI. La URL base y el modelo vienen de variables
 * de entorno: en desarrollo OpenRouter (por costos, con datos ficticios); en producción, un modelo de OpenAI
 * elegido con el eval y la evaluación de impacto (DPIA). OpenRouter recibe las preferencias de proveedor:
 * solo los que respetan el esquema y no guardan datos.
 */
export class OpenAiProfileModel implements ProfileModel {
  readonly modelName: string;
  /** Tokens acumulados (para el eval de costo). */
  readonly usage = { promptTokens: 0, completionTokens: 0 };
  private readonly client: OpenAI;
  private readonly isOpenRouter: boolean;

  constructor(config: AiConfig) {
    this.modelName = config.model;
    this.isOpenRouter = /openrouter\.ai/.test(config.baseURL);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      // El tiempo de espera lo controla la API con su propia señal (10 s) y no hay reintentos: hay alternativa.
      maxRetries: 0,
      defaultHeaders: this.isOpenRouter ? { 'X-Title': 'Kamai - perfil asistido (prototipo)' } : undefined,
    });
  }

  async suggest(description: string, signal: AbortSignal): Promise<unknown> {
    const body = {
      model: this.modelName,
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: 'system' as const, content: PROFILE_SYSTEM_PROMPT },
        { role: 'user' as const, content: description },
      ],
      response_format: {
        type: 'json_schema' as const,
        json_schema: {
          name: PROFILE_ASSIST_JSON_SCHEMA.name,
          strict: PROFILE_ASSIST_JSON_SCHEMA.strict,
          schema: PROFILE_ASSIST_JSON_SCHEMA.schema as unknown as Record<string, unknown>,
        },
      },
      ...(this.isOpenRouter ? { provider: { require_parameters: true, data_collection: 'deny' } } : {}),
    };
    let content: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create(
        body as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        { signal },
      );
      content = completion.choices[0]?.message?.content;
      this.usage.promptTokens += completion.usage?.prompt_tokens ?? 0;
      this.usage.completionTokens += completion.usage?.completion_tokens ?? 0;
    } catch (error) {
      if (signal.aborted) throw new ServiceError('profile-model', 'timeout', 'El modelo tardó demasiado');
      const status = (error as { status?: number }).status;
      throw new ServiceError(
        'profile-model',
        status === 402 || status === 429 ? 'quota' : 'unavailable',
        `Proveedor de IA: ${status ?? 'sin respuesta'}`,
        status,
      );
    }
    if (!content) throw new ServiceError('profile-model', 'rejected', 'Respuesta vacía');
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new ServiceError('profile-model', 'rejected', 'La respuesta no es JSON');
    }
  }
}
