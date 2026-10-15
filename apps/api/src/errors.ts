/** Error con código estable para la web y mensaje para la usuaria, en español neutro. */
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

export const notFound = (what = 'Eso') =>
  new ApiError(404, 'NOT_FOUND', `${what} no existe o no es de tu negocio.`);

export const forbidden = () => new ApiError(403, 'FORBIDDEN', 'Tu usuario no puede ver esta información.');

export const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', 'Necesitas iniciar sesión.');

export const validationError = (message: string, details?: Record<string, unknown>) =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);

export const serviceUnavailable = () =>
  new ApiError(
    503,
    'SERVICE_UNAVAILABLE',
    'No pudimos guardar ni leer tus datos ahora. Intenta de nuevo en un rato.',
  );

export const INTERNAL_MESSAGE = 'Algo falló de nuestro lado. Intenta de nuevo en un rato.';
