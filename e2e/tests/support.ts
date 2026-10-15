import type { APIRequestContext, Page } from '@playwright/test';

/** Vuelve la demostración al estado inicial del caso (solo con DEMO_MODE). */
export async function resetDemo(request: APIRequestContext): Promise<void> {
  const res = await request.post('/api/demo/reset');
  if (!res.ok()) throw new Error(`No se pudo reiniciar la demostración: ${res.status()}`);
}

/** «Simular el paso del tiempo»: llegan las facturas sintéticas de julio a septiembre. */
export async function simulateTime(request: APIRequestContext): Promise<void> {
  const res = await request.post('/api/demo/simulate-time');
  if (!res.ok()) throw new Error(`No se pudo simular el paso del tiempo: ${res.status()}`);
}

/** «Ver como»: la web manda `X-Demo-User` según esta elección. */
export async function viewAs(page: Page, user: 'ines' | 'nuevo' | 'aliado' | 'equipo'): Promise<void> {
  await page.goto(`/?verComo=${user}`);
}

/**
 * Imagen BMP sintética de 24 bits (el navegador la decodifica y la app la convierte a JPEG al comprimir).
 * `pixel(x, y)` devuelve el gris de cada punto.
 */
export function syntheticBmp(width: number, height: number, pixel: (x: number, y: number) => number): Buffer {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + rowSize * height;
  const buf = Buffer.alloc(size);
  buf.write('BM', 0);
  buf.writeUInt32LE(size, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(rowSize * height, 34);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const v = pixel(x, y);
      buf[row + x * 3] = v;
      buf[row + x * 3 + 1] = v;
      buf[row + x * 3 + 2] = v;
    }
  }
  return buf;
}

/** Textura nítida con ruido para que la compresión no la reduzca a nada. */
export const sharpNoise = (x: number, y: number) =>
  ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? 50 : 200) + ((x * 7 + y * 13) % 17);
