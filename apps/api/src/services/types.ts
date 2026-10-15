import type { Currency, IsoDate } from '@ppam/domain';

/** Reloj inyectable: la demostración y los tests fijan «hoy». */
export interface Clock {
  today(): IsoDate;
  now(): Date;
}

/** Por qué falló un servicio externo. La API traduce cada tipo a lo que ve la usuaria. */
export type ServiceFailure = 'timeout' | 'unavailable' | 'quota' | 'rejected';

export class ServiceError extends Error {
  constructor(
    readonly service: 'profile-model' | 'subtasks' | 'messaging' | 'currency' | 'storage',
    readonly failure: ServiceFailure,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/** Modelo de IA del perfil asistido: devuelve el JSON crudo que produjo el modelo (se valida después en el dominio). */
export interface ProfileModel {
  readonly modelName: string;
  suggest(description: string, signal: AbortSignal): Promise<unknown>;
}

/** Servicio existente de subtareas con IA (`POST /ia/ecoinnovation/sub-tasks`). 402 = sin cupo ni créditos. */
export interface SubtasksService {
  generate(
    input: { userEcoCardId: string; stepsId: string[] },
    signal: AbortSignal,
  ): Promise<{ steps: { _id: string; subSteps: string[] }[] }>;
}

/** Servicio existente de mensajería (`POST {MESSAGING_SERVICE_URL}/v1/email/send`). Resuelve cuando responde 200. */
export interface MessagingService {
  send(message: { email: string; subject: string; html: string }): Promise<void>;
}

/** Servicio existente de conversión de moneda. */
export interface CurrencyService {
  rate(from: Currency, to: Currency, date: IsoDate): Promise<number>;
}

/** Almacenamiento de archivos para las fotos de factura. */
export interface FileStorage {
  put(content: Buffer, contentType: string): Promise<{ fileId: string }>;
  exists(fileId: string): Promise<boolean>;
}

export interface Services {
  profileModel: ProfileModel | null;
  subtasks: SubtasksService;
  messaging: MessagingService;
  currency: CurrencyService;
  storage: FileStorage;
}
