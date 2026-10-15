import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Currency, IsoDate } from '@ppam/domain';
import {
  ServiceError,
  type CurrencyService,
  type FileStorage,
  type MessagingService,
  type SubtasksService,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Traduce la respuesta HTTP a un `ServiceError` con el tipo de falla que la API sabe mostrar. */
function failureFor(status: number): ServiceError['failure'] {
  if (status === 402) return 'quota';
  if (status === 429 || status >= 500) return 'unavailable';
  return 'rejected';
}

async function call(
  service: ServiceError['service'],
  url: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ServiceError(
      service,
      timeout ? 'timeout' : 'unavailable',
      timeout ? 'Tiempo de espera agotado' : 'Sin respuesta',
    );
  }
  if (!res.ok) throw new ServiceError(service, failureFor(res.status), `HTTP ${res.status}`, res.status);
  return res;
}

/** Mensajería existente: `POST {MESSAGING_SERVICE_URL}/v1/email/send` con `x-api-key`. */
export class HttpMessaging implements MessagingService {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async send(message: { email: string; subject: string; html: string }): Promise<void> {
    await call('messaging', `${this.baseUrl}/v1/email/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify(message),
    });
  }
}

/** Subtareas con IA existentes: `POST {SUBTASKS_SERVICE_URL}/ia/ecoinnovation/sub-tasks`. */
export class HttpSubtasks implements SubtasksService {
  constructor(private readonly baseUrl: string) {}

  async generate(input: { userEcoCardId: string; stepsId: string[] }, signal: AbortSignal) {
    const res = await call('subtasks', `${this.baseUrl}/ia/ecoinnovation/sub-tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
    const body = (await res.json()) as { steps?: { _id: string; subSteps: string[] }[] };
    if (!Array.isArray(body.steps)) throw new ServiceError('subtasks', 'rejected', 'Respuesta sin pasos');
    return { steps: body.steps };
  }
}

/** Conversión de moneda: `GET {CURRENCY_SERVICE_URL}/rate?from&to&date`. */
export class HttpCurrency implements CurrencyService {
  constructor(private readonly baseUrl: string) {}

  async rate(from: Currency, to: Currency, date: IsoDate): Promise<number> {
    const query = new URLSearchParams({ from, to, date });
    const res = await call('currency', `${this.baseUrl}/rate?${query}`, { method: 'GET' });
    const body = (await res.json()) as { rate?: unknown };
    if (typeof body.rate !== 'number' || !(body.rate > 0))
      throw new ServiceError('currency', 'rejected', 'Tipo de cambio inválido');
    return body.rate;
  }
}

/** Fotos en disco local (en Kamai, Cloud Storage detrás de la misma interfaz). */
export class DiskStorage implements FileStorage {
  constructor(private readonly dir: string) {}

  async put(content: Buffer, contentType: string): Promise<{ fileId: string }> {
    await mkdir(this.dir, { recursive: true });
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const fileId = `file_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    try {
      await writeFile(path.join(this.dir, `${fileId}.${ext}`), content);
    } catch {
      throw new ServiceError('storage', 'unavailable', 'No se pudo guardar el archivo');
    }
    return { fileId };
  }

  async exists(fileId: string): Promise<boolean> {
    for (const ext of ['jpg', 'png', 'webp'])
      if (
        await stat(path.join(this.dir, `${fileId}.${ext}`)).then(
          () => true,
          () => false,
        )
      )
        return true;
    return false;
  }

  async read(fileId: string): Promise<Buffer | null> {
    for (const ext of ['jpg', 'png', 'webp']) {
      const content = await readFile(path.join(this.dir, `${fileId}.${ext}`)).catch(() => null);
      if (content) return content;
    }
    return null;
  }
}
