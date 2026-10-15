/** Espacio duro (U+00A0) y espacio fino duro (U+202F) que usan `Intl` y los porcentajes. */
const HARD_SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g');

/** Reemplaza los espacios duros de `Intl` y de los porcentajes por espacios comunes. */
export function plain(text: unknown): string {
  return String(text ?? '').replace(HARD_SPACES, ' ');
}
