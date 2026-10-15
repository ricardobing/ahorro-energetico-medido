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

export const DEFAULT_CONFIG: AppConfig = {
  port: 4100,
  demoMode: false,
  testRoutes: false,
  mongoUri: null,
  profileAssist: { enabled: false, timeoutMs: 10_000, maxRequestsPerDay: 20 },
  subtasksTimeoutMs: 10_000,
  messaging: { url: 'http://localhost:4110/messaging', apiKey: 'dev-only' },
  currencyUrl: 'http://localhost:4110/currency',
  outboxBackoffMs: [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000],
};

/**
 * Lee la configuración de las variables de entorno. Se niega a arrancar con `DEMO_MODE=true` y
 * `NODE_ENV=production` (decisión D20).
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  throw new Error(`No implementado todavía: loadConfig (${Object.keys(env).length} variables)`);
}
