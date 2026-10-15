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

/**
 * Revisión de calidad en el teléfono (D16): tamaño (1000 px o más de lado largo), luz (luminancia media
 * entre 50 y 225) y nitidez (varianza del laplaciano). No bloquea: la usuaria puede guardar igual.
 */
export function assessPhotoQuality(image: PixelImage): PhotoQuality {
  throw new Error(`No implementado todavía: assessPhotoQuality (${image.width}x${image.height})`);
}
