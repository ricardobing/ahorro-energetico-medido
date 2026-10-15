import express, { type Express, type Request, type Response } from 'express';

export interface MocksOptions {
  /** Clave que exige la mensajería simulada (`x-api-key`), como el servicio real. */
  messagingApiKey: string;
  /** URL del webhook de rebotes de la API (`POST /webhooks/messaging/bounce`). */
  bounceWebhookUrl: string | null;
}

/** Modos de falla de cada servicio. `ok` es el comportamiento normal del contrato. */
const MODES = {
  messaging: ['ok', 'error', 'reject', 'slow', 'bounce'],
  subtasks: ['ok', 'error', 'quota', 'slow'],
  currency: ['ok', 'down', 'slow'],
} as const;

type Service = keyof typeof MODES;
type Mode<S extends Service> = (typeof MODES)[S][number];

interface ServiceState<S extends Service> {
  mode: Mode<S>;
  delayMs: number;
}

interface SentEmail {
  email: string;
  subject: string;
  html: string;
}

const DEFAULT_DELAY_MS = 12_000;

/** Tipos de cambio SINTÉTICOS (no son cotizaciones reales). */
const SYNTHETIC_RATES: Record<string, number> = {
  'PEN:USD': 0.27,
  'BOB:USD': 0.145,
  'USD:PEN': 3.7,
  'USD:BOB': 6.9,
};

/** Ideas genéricas por paso: la simulación no llama a ningún modelo. */
const SUBSTEP_IDEAS = [
  'Anotar en una hoja qué se hizo y en qué fecha',
  'Pedir a una persona del equipo que lo revise contigo',
  'Sacar una foto antes y otra después',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isService = (value: unknown): value is Service => typeof value === 'string' && value in MODES;

/**
 * Simulaciones de los servicios existentes de Kamai, con los contratos del anexo y modos de falla
 * controlables desde `POST /__control` (panel de demostración y tests).
 */
export function createMocksApp(options: MocksOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const initial = () => ({
    messaging: { mode: 'ok', delayMs: DEFAULT_DELAY_MS } as ServiceState<'messaging'>,
    subtasks: { mode: 'ok', delayMs: DEFAULT_DELAY_MS } as ServiceState<'subtasks'>,
    currency: { mode: 'ok', delayMs: DEFAULT_DELAY_MS } as ServiceState<'currency'>,
  });
  let state = initial();
  let sent: SentEmail[] = [];

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', bounceWebhook: options.bounceWebhookUrl !== null });
  });

  // --- Control de los modos de falla ---
  app.get('/__control', (_req, res) => {
    res.json(state);
  });
  app.post('/__control', (req: Request, res: Response) => {
    const { service, mode, delayMs } = (req.body ?? {}) as {
      service?: unknown;
      mode?: unknown;
      delayMs?: unknown;
    };
    if (!isService(service) || !(MODES[service] as readonly unknown[]).includes(mode)) {
      res.status(400).json({ error: { code: 'UNKNOWN_MODE', message: 'Servicio o modo desconocido' } });
      return;
    }
    const delay =
      typeof delayMs === 'number' && delayMs >= 0 && delayMs <= 60_000 ? delayMs : DEFAULT_DELAY_MS;
    (state[service] as ServiceState<Service>) = { mode: mode as Mode<Service>, delayMs: delay };
    res.status(204).end();
  });
  app.post('/__control/reset', (_req, res) => {
    state = initial();
    sent = [];
    res.status(204).end();
  });
  app.get('/__control/messaging/sent', (_req, res) => {
    res.json({ items: sent });
  });

  // --- Mensajería (anexo: POST /v1/email/send con x-api-key) ---
  app.post('/messaging/v1/email/send', async (req, res) => {
    if (req.get('x-api-key') !== options.messagingApiKey) {
      res.status(401).json({ error: 'invalid api key' });
      return;
    }
    const { email, subject, html } = (req.body ?? {}) as Partial<SentEmail>;
    if (typeof email !== 'string' || typeof subject !== 'string' || typeof html !== 'string') {
      res.status(400).json({ error: 'email, subject y html son obligatorios' });
      return;
    }
    const { mode, delayMs } = state.messaging;
    if (mode === 'slow') await sleep(delayMs);
    if (mode === 'error') {
      res.status(500).json({ error: 'internal error' });
      return;
    }
    if (mode === 'reject') {
      res.status(400).json({ error: 'invalid recipient' });
      return;
    }
    sent.push({ email, subject, html });
    res.status(200).json({ status: 'queued' });
    if (mode === 'bounce' && options.bounceWebhookUrl) {
      // El proveedor avisa el rebote después, por webhook. Un fallo del webhook no afecta el envío.
      void fetch(options.bounceWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': options.messagingApiKey },
        body: JSON.stringify({ email, reason: 'bounced' }),
      }).catch(() => undefined);
    }
  });

  // --- Subtareas con IA (anexo: POST /ia/ecoinnovation/sub-tasks) ---
  app.post('/subtasks/ia/ecoinnovation/sub-tasks', async (req, res) => {
    const { userEcoCardId, stepsId } = (req.body ?? {}) as { userEcoCardId?: unknown; stepsId?: unknown };
    if (
      typeof userEcoCardId !== 'string' ||
      !Array.isArray(stepsId) ||
      !stepsId.every((s) => typeof s === 'string')
    ) {
      res.status(400).json({ error: 'userEcoCardId y stepsId son obligatorios' });
      return;
    }
    const { mode, delayMs } = state.subtasks;
    if (mode === 'slow') await sleep(delayMs);
    if (mode === 'quota') {
      res.status(402).json({ error: 'Sin cupo mensual ni créditos' });
      return;
    }
    if (mode === 'error') {
      res.status(500).json({ error: 'internal error' });
      return;
    }
    res.json({ steps: (stepsId as string[]).map((_id) => ({ _id, subSteps: SUBSTEP_IDEAS })) });
  });

  // --- Conversión de moneda (sintética) ---
  app.get('/currency/rate', async (req, res) => {
    const { from, to, date } = req.query as Record<string, string | undefined>;
    const { mode, delayMs } = state.currency;
    if (mode === 'slow') await sleep(delayMs);
    if (mode === 'down') {
      res.status(503).json({ error: 'service unavailable' });
      return;
    }
    const rate = SYNTHETIC_RATES[`${from}:${to}`];
    if (!date || rate === undefined) {
      res.status(400).json({ error: 'Par de monedas o fecha no soportados' });
      return;
    }
    res.json({ from, to, date, rate, synthetic: true });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
  });
  return app;
}
