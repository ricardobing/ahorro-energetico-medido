import { notImplemented } from './not-implemented.js';

/**
 * JSON canónico: claves ordenadas en todos los niveles y sin espacios, para que dos valores iguales
 * den el mismo texto (y la misma huella) aunque sus claves vengan en otro orden.
 */
export function canonicalJson(value: unknown): string {
  return notImplemented(`canonicalJson(${typeof value})`);
}
