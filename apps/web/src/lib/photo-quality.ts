export type PhotoProblem = 'small' | 'dark' | 'bright' | 'blurry';

export interface PixelImage {
  width: number;
  height: number;
  /** RGBA, como `ImageData.data`. */
  data: Uint8ClampedArray;
}

export interface PhotoQuality {
  ok: boolean;
  problems: PhotoProblem[];
  /** Consejo para la usuaria, o `null` si la foto está bien. */
  message: string | null;
}

const MIN_LONG_SIDE = 1000;
const MIN_LUMINANCE = 50;
const MAX_LUMINANCE = 225;
/** Varianza del laplaciano por debajo de la cual el texto no se lee (foto movida o fuera de foco). */
const MIN_SHARPNESS = 60;

export const PHOTO_TIP = 'La foto se ve oscura o movida. Tómala con buena luz y que se lean los kWh.';

/**
 * Revisión de calidad en el teléfono (D16): tamaño (1000 px o más de lado largo), luz (luminancia media
 * entre 50 y 225) y nitidez (varianza del laplaciano). No bloquea: la usuaria puede guardar igual.
 * `longSide` permite revisar una copia reducida sin perder el tamaño de la foto original.
 */
export function assessPhotoQuality(image: PixelImage, opts: { longSide?: number } = {}): PhotoQuality {
  const { width, height, data } = image;
  const problems: PhotoProblem[] = [];
  if ((opts.longSide ?? Math.max(width, height)) < MIN_LONG_SIDE) problems.push('small');

  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const l = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
    gray[i] = l;
    sum += l;
  }
  const mean = gray.length ? sum / gray.length : 0;
  if (mean < MIN_LUMINANCE) problems.push('dark');
  else if (mean > MAX_LUMINANCE) problems.push('bright');

  // Laplaciano de 4 vecinos sobre una grilla de muestreo (rápido en fotos grandes).
  const step = Math.max(1, Math.floor(Math.max(width, height) / 800));
  let n = 0;
  let lapSum = 0;
  let lapSq = 0;
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const i = y * width + x;
      const lap = gray[i - 1]! + gray[i + 1]! + gray[i - width]! + gray[i + width]! - 4 * gray[i]!;
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const variance = n ? lapSq / n - (lapSum / n) ** 2 : 0;
  if (variance < MIN_SHARPNESS) problems.push('blurry');

  return { ok: problems.length === 0, problems, message: problems.length ? PHOTO_TIP : null };
}
