import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const dist = join(import.meta.dirname, '..', 'dist');

/** JavaScript que carga la primera pantalla: los scripts de módulo y sus modulepreload de index.html. */
function initialScripts(): string[] {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  return [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]!);
}

describe('Datos móviles limitados', () => {
  it('Peso de la aplicación', () => {
    expect(existsSync(join(dist, 'index.html')), 'corre `npm run build` antes').toBe(true);
    const total = initialScripts().reduce(
      (sum, file) => sum + gzipSync(readFileSync(join(dist, file))).length,
      0,
    );
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(120 * 1024);
  });
});
