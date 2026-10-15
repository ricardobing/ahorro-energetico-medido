import express, { type Express } from 'express';

export interface MocksOptions {
  /** Clave que exige la mensajería simulada (`x-api-key`), como el servicio real. */
  messagingApiKey: string;
  /** URL del webhook de rebotes de la API (`POST /webhooks/messaging/bounce`). */
  bounceWebhookUrl: string | null;
}

/**
 * Simulaciones de los servicios existentes de Kamai, con los contratos del anexo y modos de falla
 * controlables desde `POST /__control`. Etapa 2: solo existe la app; las rutas se implementan en la etapa 3.
 */
export function createMocksApp(options: MocksOptions): Express {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', bounceWebhook: options.bounceWebhookUrl !== null });
  });
  app.use((_req, res) => {
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } });
  });
  return app;
}
