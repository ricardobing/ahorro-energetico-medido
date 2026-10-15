import { Writable } from 'node:stream';
import pino, { type Logger } from 'pino';
import type { Currency, IsoDate } from '@ppam/domain';
import { DEMO_TODAY } from '@ppam/fixtures';
import {
  ServiceError,
  type Clock,
  type CurrencyService,
  type FileStorage,
  type MessagingService,
  type ProfileModel,
  type SubtasksService,
} from '../../src/services/types.js';

export class FakeClock implements Clock {
  constructor(public date: IsoDate = DEMO_TODAY) {}
  today(): IsoDate {
    return this.date;
  }
  now(): Date {
    return new Date(`${this.date}T12:00:00.000Z`);
  }
  set(date: IsoDate): void {
    this.date = date;
  }
}

/** Espera hasta que se cancele la señal y entonces falla como un timeout. */
function hangUntilAbort(service: ServiceError['service'], signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => reject(new ServiceError(service, 'timeout', 'Tiempo de espera agotado')),
      { once: true },
    );
  });
}

export class FakeProfileModel implements ProfileModel {
  readonly modelName = 'modelo-de-prueba';
  mode: 'ok' | 'hang' | 'error' = 'ok';
  /** Respuesta grabada del modelo (JSON crudo). */
  response: unknown = null;
  calls: string[] = [];

  async suggest(description: string, signal: AbortSignal): Promise<unknown> {
    this.calls.push(description);
    if (this.mode === 'error') throw new ServiceError('profile-model', 'unavailable', 'Proveedor caído');
    if (this.mode === 'hang') return hangUntilAbort('profile-model', signal);
    return this.response;
  }
}

export class FakeSubtasks implements SubtasksService {
  mode: 'ok' | 'quota' | 'error' | 'hang' = 'ok';
  calls = 0;

  async generate(input: { userEcoCardId: string; stepsId: string[] }, signal: AbortSignal) {
    this.calls++;
    if (this.mode === 'quota') throw new ServiceError('subtasks', 'quota', 'Sin cupo ni créditos', 402);
    if (this.mode === 'error') throw new ServiceError('subtasks', 'unavailable', 'Error del servicio', 500);
    if (this.mode === 'hang') return hangUntilAbort('subtasks', signal);
    return {
      steps: input.stepsId.map((_id) => ({
        _id,
        subSteps: [
          'Revisar el estado de cada burlete con una hoja de papel',
          'Anotar cuáles hay que cambiar',
        ],
      })),
    };
  }
}

/** Mensajería con un guion de respuestas: cada envío consume un código (200 por defecto). */
export class FakeMessaging implements MessagingService {
  script: number[] = [];
  defaultStatus = 200;
  sent: { email: string; subject: string; html: string }[] = [];
  attempts = 0;

  async send(message: { email: string; subject: string; html: string }): Promise<void> {
    this.attempts++;
    const status = this.script.shift() ?? this.defaultStatus;
    if (status === 200) {
      this.sent.push(message);
      return;
    }
    const temporary = status === 429 || status >= 500 || status === 0;
    throw new ServiceError('messaging', temporary ? 'unavailable' : 'rejected', `HTTP ${status}`, status);
  }
}

/** Tipos de cambio SINTÉTICOS para el informe de aliados. */
export class FakeCurrency implements CurrencyService {
  down = false;
  rates: Record<string, number> = { 'PEN:USD': 0.27, 'BOB:USD': 0.145 };

  async rate(from: Currency, to: Currency, _date: IsoDate): Promise<number> {
    if (this.down) throw new ServiceError('currency', 'unavailable', 'Conversión caída');
    const rate = this.rates[`${from}:${to}`];
    if (rate === undefined)
      throw new ServiceError('currency', 'rejected', `Sin tipo de cambio ${from}→${to}`);
    return rate;
  }
}

export class MemoryStorage implements FileStorage {
  files = new Map<string, { content: Buffer; contentType: string }>();
  private next = 1;

  async put(content: Buffer, contentType: string) {
    const fileId = `file_${this.next++}`;
    this.files.set(fileId, { content, contentType });
    return { fileId };
  }

  async exists(fileId: string) {
    return this.files.has(fileId);
  }
}

/** Logger que guarda cada línea JSON, para verificar qué se registra (y qué no). */
export function createMemoryLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { logger: pino({ level: 'debug' }, stream), lines };
}

/** PNG mínimo válido (1 × 1) para subir como foto de factura. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
