import { PROFILE_ASSIST_PARAMS } from '@ppam/domain';

export interface AppConfig {
  port: number;
  /** Habilita `X-Demo-User`, el reloj fijo y el panel de demostración. Nunca en producción. */
  demoMode: boolean;
  /** Rutas de prueba (`/__test/*`), solo en los tests de integración. */
  testRoutes: boolean;
  mongoUri: string | null;
  profileAssist: {
    enabled: boolean;
    timeoutMs: number;
    maxRequestsPerDay: number;
  };
  subtasksTimeoutMs: number;
  messaging: { url: string; apiKey: string };
  currencyUrl: string;
  /** Envíos de la bandeja de salida: esperas entre reintentos, en milisegundos. */
  outboxBackoffMs: number[];
}

/** Lo que necesita el adaptador de IA; vive aparte para que la clave nunca viaje dentro de `AppConfig`. */
export interface AiConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  port: 4100,
  demoMode: false,
  testRoutes: false,
  mongoUri: null,
  profileAssist: {
    enabled: false,
    timeoutMs: PROFILE_ASSIST_PARAMS.timeoutMs,
    maxRequestsPerDay: PROFILE_ASSIST_PARAMS.maxRequestsPerDay,
  },
  subtasksTimeoutMs: 10_000,
  messaging: { url: 'http://localhost:4110/messaging', apiKey: 'solo-desarrollo' },
  currencyUrl: 'http://localhost:4110/currency',
  outboxBackoffMs: [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000],
};

const truthy = (value: string | undefined) => value === 'true' || value === '1';

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`${name} tiene que ser un entero positivo (vino «${value}»)`);
  return n;
}

/**
 * Lee la configuración de las variables de entorno. Se niega a arrancar con `DEMO_MODE=true` y
 * `NODE_ENV=production` (decisión D20).
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const demoMode = truthy(env.DEMO_MODE);
  if (demoMode && env.NODE_ENV === 'production')
    throw new Error(
      'DEMO_MODE=true no se permite con NODE_ENV=production: habilitaría «Ver como» sin autenticación.',
    );
  const hasKey = Boolean(env.AI_API_KEY && env.AI_API_KEY.trim());
  return {
    port: positiveInt(env.PORT, DEFAULT_CONFIG.port, 'PORT'),
    demoMode,
    testRoutes: false,
    mongoUri: env.MONGODB_URI?.trim() || null,
    profileAssist: {
      // Sin clave no hay IA, diga lo que diga la bandera: la app sugiere por palabras clave.
      enabled: truthy(env.AI_PROFILE_ASSIST_ENABLED) && hasKey,
      timeoutMs: positiveInt(env.AI_TIMEOUT_MS, DEFAULT_CONFIG.profileAssist.timeoutMs, 'AI_TIMEOUT_MS'),
      maxRequestsPerDay: positiveInt(
        env.AI_MAX_REQUESTS_PER_DAY,
        DEFAULT_CONFIG.profileAssist.maxRequestsPerDay,
        'AI_MAX_REQUESTS_PER_DAY',
      ),
    },
    subtasksTimeoutMs: positiveInt(
      env.SUBTASKS_TIMEOUT_MS,
      DEFAULT_CONFIG.subtasksTimeoutMs,
      'SUBTASKS_TIMEOUT_MS',
    ),
    messaging: {
      url: env.MESSAGING_SERVICE_URL || DEFAULT_CONFIG.messaging.url,
      apiKey: env.MESSAGING_API_KEY || DEFAULT_CONFIG.messaging.apiKey,
    },
    currencyUrl: env.CURRENCY_SERVICE_URL || DEFAULT_CONFIG.currencyUrl,
    outboxBackoffMs: DEFAULT_CONFIG.outboxBackoffMs,
  };
}

/** Configuración del proveedor de IA, o `null` si falta la clave. */
export function loadAiConfig(env: NodeJS.ProcessEnv): AiConfig | null {
  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    baseURL: env.AI_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
    apiKey,
    model: env.AI_MODEL_TEXT?.trim() || 'deepseek/deepseek-v4.1-flash',
  };
}

/** URL del servicio de subtareas y de los controles de las simulaciones (solo demostración). */
export function loadServiceUrls(env: NodeJS.ProcessEnv): {
  subtasksUrl: string;
  mocksControlUrl: string | null;
} {
  return {
    subtasksUrl: env.SUBTASKS_SERVICE_URL || 'http://localhost:4110/subtasks',
    mocksControlUrl: env.MOCKS_CONTROL_URL || 'http://localhost:4110/__control',
  };
}
