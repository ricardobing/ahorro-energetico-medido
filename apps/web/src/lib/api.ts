/** Cliente de la API: mismo origen (`/api`, proxy de Vite), errores con el formato uniforme del servidor. */

export type DemoUser = 'ines' | 'nuevo' | 'aliado' | 'equipo';
const DEMO_USERS: DemoUser[] = ['ines', 'nuevo', 'aliado', 'equipo'];
const DEMO_KEY = 'kamai.verComo';

/** Error de la API con el código estable y el mensaje para la usuaria que manda el servidor. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Sin conexión: el pedido no llegó al servidor. */
export class OfflineError extends Error {
  constructor() {
    super('No hay conexión.');
    this.name = 'OfflineError';
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** «Ver como» de la demostración: `?verComo=` en la URL, o lo último elegido. Inés por defecto. */
export function currentDemoUser(): DemoUser {
  const fromUrl = new URLSearchParams(window.location.search).get('verComo');
  if (fromUrl && (DEMO_USERS as string[]).includes(fromUrl)) {
    storage()?.setItem(DEMO_KEY, fromUrl);
    return fromUrl as DemoUser;
  }
  const saved = storage()?.getItem(DEMO_KEY);
  return saved && (DEMO_USERS as string[]).includes(saved) ? (saved as DemoUser) : 'ines';
}

export function setDemoUser(user: DemoUser): void {
  storage()?.setItem(DEMO_KEY, user);
}

const GENERIC = 'Algo falló de nuestro lado. Intenta de nuevo en un rato.';

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      headers: {
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        'X-Demo-User': currentDemoUser(),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new OfflineError();
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as
    (T & { error?: { code: string; message: string; details?: Record<string, unknown> } }) | null;
  if (!res.ok) {
    const error = body?.error;
    throw new ApiError(res.status, error?.code ?? 'HTTP_ERROR', error?.message ?? GENERIC, error?.details);
  }
  return body as T;
}

/** Mensaje para mostrar de cualquier error: el del servidor, o uno claro si no hubo conexión. */
export function errorMessage(error: unknown): string {
  if (error instanceof OfflineError) return 'No hay conexión. Revisa tus datos o tu wifi e intenta de nuevo.';
  if (error instanceof ApiError) return error.message;
  return GENERIC;
}

/**
 * Sube la foto ya comprimida como `multipart/form-data` armado a mano con sus bytes: el cuerpo pesa lo
 * mismo que con `FormData` y, a diferencia de un `Blob`, el navegador lo expone a las herramientas de red.
 */
export async function uploadPhoto(blob: Blob): Promise<{ fileId: string }> {
  const boundary = `----kamai${Math.random().toString(36).slice(2)}`;
  const encoder = new TextEncoder();
  const CRLF = '\r\n';
  const head = encoder.encode(
    [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="factura.jpg"',
      `Content-Type: ${blob.type || 'image/jpeg'}`,
      '',
      '',
    ].join(CRLF),
  );
  const tail = encoder.encode(`${CRLF}--${boundary}--${CRLF}`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return api<{ fileId: string }>('/uploads', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}
