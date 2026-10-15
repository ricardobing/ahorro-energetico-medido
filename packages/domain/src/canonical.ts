function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

/**
 * JSON canónico: claves ordenadas en todos los niveles y sin espacios, para que dos valores iguales
 * den el mismo texto (y la misma huella) aunque sus claves vengan en otro orden.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
