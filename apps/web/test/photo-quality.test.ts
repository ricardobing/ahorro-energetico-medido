import { describe, expect, it } from 'vitest';
import { assessPhotoQuality, type PixelImage } from '../src/lib/photo-quality';

/** Imagen sintética: `pixel(x, y)` devuelve el gris de cada punto. */
function image(width: number, height: number, pixel: (x: number, y: number) => number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Texto nítido simulado: cuadros chicos de alto contraste. */
const sharp = (x: number, y: number) => ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? 40 : 210);
const TIP = 'La foto se ve oscura o movida. Tómala con buena luz y que se lean los kWh.';

describe('Revisión de calidad de la foto en el dispositivo', () => {
  it('Foto oscura o movida', () => {
    const dark = assessPhotoQuality(image(1200, 1600, () => 18));
    expect(dark.ok).toBe(false);
    expect(dark.problems).toContain('dark');
    expect(dark.message).toBe(TIP);

    const blurry = assessPhotoQuality(image(1200, 1600, (x) => 120 + Math.round((x / 1200) * 20)));
    expect(blurry.problems).toContain('blurry');
    expect(blurry.message).toBe(TIP);
  });

  it('Foto chica', () => {
    const small = assessPhotoQuality(image(800, 600, sharp));
    expect(small.problems).toEqual(['small']);
    expect(small.message).toBe(TIP);
  });

  it('una foto nítida, con luz y de buen tamaño pasa', () => {
    expect(assessPhotoQuality(image(1200, 1600, sharp))).toEqual({ ok: true, problems: [], message: null });
  });
});
