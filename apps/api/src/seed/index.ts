import type { Connection } from 'mongoose';

export interface SeedOptions {
  /** Agrega las facturas de julio a septiembre de Inés (la «simulación del paso del tiempo»). */
  simulation?: boolean;
}

/**
 * Carga los datos del caso (Inés, sus seis facturas, `plan_552`, el catálogo y la tabla de pares) y los
 * sintéticos rotulados (22 panaderías, el negocio nuevo, el catálogo ampliado y los usuarios de demostración).
 * Borra lo que haya antes: la carga es idempotente.
 */
export async function seedDemoData(connection: Connection, options: SeedOptions = {}): Promise<void> {
  throw new Error(`No implementado todavía: seedDemoData (${connection.name}, ${JSON.stringify(options)})`);
}
