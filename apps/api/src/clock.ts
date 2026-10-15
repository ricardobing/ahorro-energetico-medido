import type { IsoDate } from '@ppam/domain';
import type { Clock } from './services/types.js';

/** Fecha de hoy en la zona horaria del negocio (Perú y Bolivia no cambian de hora). */
export class SystemClock implements Clock {
  constructor(private readonly timeZone = 'America/Lima') {}

  today(): IsoDate {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.timeZone }).format(new Date());
  }

  now(): Date {
    return new Date();
  }
}

/**
 * Reloj de la demostración: «hoy» es una fecha fija (2026-07-10 al inicio) que avanza con «Simular el paso
 * del tiempo». La hora sí corre, para que los registros y reintentos tengan orden.
 */
export class DemoClock implements Clock {
  private date: IsoDate;
  private readonly startedAt = Date.now();

  constructor(initial: IsoDate) {
    this.date = initial;
  }

  set(date: IsoDate): void {
    this.date = date;
  }

  today(): IsoDate {
    return this.date;
  }

  now(): Date {
    const elapsed = (Date.now() - this.startedAt) % 43_200_000;
    return new Date(new Date(`${this.date}T12:00:00.000Z`).getTime() + elapsed);
  }
}
