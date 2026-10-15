import express, { type Express } from 'express';
import type { Connection } from 'mongoose';
import type { Logger } from 'pino';
import type { AppConfig } from './config.js';
import type { Clock, Services } from './services/types.js';

export interface AppDeps {
  connection: Connection;
  clock: Clock;
  services: Services;
  config: AppConfig;
  logger: Logger;
}

/**
 * Etapa 2: la app existe y responde `/health`; cada ruta de la capacidad responde 501 hasta que se
 * implemente en la etapa 3. Los tests de integración describen el comportamiento esperado.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', demoMode: deps.config.demoMode });
  });
  app.use((_req, res) => {
    res
      .status(501)
      .json({ error: { code: 'NOT_IMPLEMENTED', message: 'Todavía no implementado.' }, requestId: null });
  });
  return app;
}
