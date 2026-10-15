import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXT_PAIRS, TOKENS } from '../src/styles/tokens';

/** Contraste WCAG 2.2 entre dos colores hexadecimales. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('Accesibilidad', () => {
  it('Color de acento', () => {
    for (const pair of TEXT_PAIRS) expect(pair.text, pair.usage).not.toBe('accent');
    expect(contrast(TOKENS.accent, TOKENS.card)).toBeLessThan(4.5);
    expect(contrast(TOKENS.primary, TOKENS.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('todo par de texto y fondo cumple AA', () => {
    for (const { text, background, usage } of TEXT_PAIRS) {
      expect(contrast(TOKENS[text], TOKENS[background]), usage).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('los colores que no alcanzan AA no se usan para texto', () => {
    for (const forbidden of ['accent', 'mutedFg', 'info', 'warning'] as const) {
      expect(TEXT_PAIRS.some((p) => p.text === forbidden)).toBe(false);
    }
  });

  it('tokens.css declara los mismos valores que tokens.ts', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');
    const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    for (const [name, value] of Object.entries(TOKENS))
      expect(css).toContain(`--color-${kebab(name)}: ${value};`);
  });
});
