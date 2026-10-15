import { assessPhotoQuality, type PhotoQuality } from './photo-quality';

/** Tope de lo que viaja por datos móviles: 250 KB por foto (D16). */
export const MAX_UPLOAD_BYTES = 250 * 1024;
const MAX_LONG_SIDE = 1600;
const CHECK_LONG_SIDE = 800;

export interface PreparedPhoto {
  blob: Blob;
  quality: PhotoQuality;
  previewUrl: string;
  width: number;
  height: number;
}

async function decode(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function canvasFor(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function scaled(width: number, height: number, longSide: number) {
  const factor = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * factor)), height: Math.max(1, Math.round(height * factor)) };
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la foto'))),
      'image/jpeg',
      quality,
    ),
  );

/**
 * Reduce, comprime a JPEG (250 KB o menos) y revisa la calidad en el teléfono, antes de subir nada.
 * La revisión usa una copia de 800 px; la compresión baja la calidad y, si hace falta, el tamaño.
 */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const bitmap = await decode(file);
  const longSide = Math.max(bitmap.width, bitmap.height);

  const check = scaled(bitmap.width, bitmap.height, CHECK_LONG_SIDE);
  const checkCanvas = canvasFor(check.width, check.height);
  const checkCtx = checkCanvas.getContext('2d', { willReadFrequently: true })!;
  checkCtx.drawImage(bitmap, 0, 0, check.width, check.height);
  const quality = assessPhotoQuality(checkCtx.getImageData(0, 0, check.width, check.height), { longSide });

  let size = scaled(bitmap.width, bitmap.height, MAX_LONG_SIDE);
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 8 && !blob; attempt++) {
    const canvas = canvasFor(size.width, size.height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, size.width, size.height);
    for (const q of [0.82, 0.7, 0.6, 0.5]) {
      const candidate = await toBlob(canvas, q);
      if (candidate.size <= MAX_UPLOAD_BYTES) {
        blob = candidate;
        break;
      }
    }
    if (!blob) size = scaled(size.width, size.height, Math.round(Math.max(size.width, size.height) * 0.8));
  }
  bitmap.close();
  if (!blob) throw new Error('No pudimos achicar la foto. Prueba con otra.');
  return { blob, quality, previewUrl: URL.createObjectURL(blob), width: size.width, height: size.height };
}
