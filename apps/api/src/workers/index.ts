import type { AppDeps } from '../app.js';

/**
 * Tareas de fondo. En la app corren con un intervalo; en los tests se llaman directamente para que
 * el resultado no dependa del tiempo real.
 */

/** Envía los correos pendientes cuya hora de reintento ya llegó. Devuelve cuántos procesó. */
export async function processOutbox(deps: AppDeps): Promise<{ processed: number }> {
  throw new Error(`No implementado todavía: processOutbox (${deps.clock.today()})`);
}

/** Encola los recordatorios de factura que corresponden hoy (sin repetir periodo). */
export async function scheduleBillReminders(deps: AppDeps): Promise<{ scheduled: number }> {
  throw new Error(`No implementado todavía: scheduleBillReminders (${deps.clock.today()})`);
}

/** Recalcula las estadísticas de pares por sector y ecoinnovación, sin combinaciones. */
export async function recomputePeerStats(deps: AppDeps): Promise<{ version: string }> {
  throw new Error(`No implementado todavía: recomputePeerStats (${deps.clock.today()})`);
}
