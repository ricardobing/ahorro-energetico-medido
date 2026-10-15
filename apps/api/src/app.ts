import { randomUUID } from 'node:crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import type { Connection } from 'mongoose';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import type { AppConfig } from './config.js';
import { ApiError, INTERNAL_MESSAGE, serviceUnavailable } from './errors.js';
import { authenticate } from './http/auth.js';
import { billRoutes } from './routes/bills.js';
import { demoRoutes, type DemoControls } from './routes/demo.js';
import { firstStepRoutes } from './routes/first-step.js';
import { notificationRoutes } from './routes/notifications.js';
import { partnerRoutes } from './routes/partners.js';
import { planRoutes } from './routes/plans.js';
import { profileRoutes } from './routes/profile.js';
import { savingsRoutes } from './routes/savings.js';
import type { Clock, Services } from './services/types.js';

export interface AppDeps {
  connection: Connection;
  clock: Clock;
  services: Services;
  config: AppConfig;
  logger: Logger;
  /** Solo en demostración: reloj ajustable y controles de las simulaciones. */
  demo?: DemoControls;
}

const REQUEST_ID = /^[\w-]{8,64}$/;

/** Errores de MongoDB que significan «la base no está disponible» (→ 503, D: qué pasa cuando algo falla). */
function isDatabaseDown(error: unknown, connection: Connection): boolean {
  if (connection.readyState !== 1) return true;
  const name = (error as { name?: string }).name ?? '';
  const message = (error as { message?: string }).message ?? '';
  return (
    /^Mongo(Network|ServerSelection|NotConnected|TopologyClosed|ExpiredSession)Error$/.test(name) ||
    name === 'MongooseServerSelectionError' ||
    /client must be connected|connection (was )?(force )?closed|before initial connection/i.test(message)
  );
}

function toApiError(error: unknown, deps: AppDeps): ApiError | null {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join('.') || 'cuerpo';
    return new ApiError(
      400,
      'VALIDATION_ERROR',
      `Revisa el dato «${field}»: ${issue?.message ?? 'no es válido'}.`,
      {
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    );
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE')
      return new ApiError(
        413,
        'FILE_TOO_LARGE',
        'La foto pesa más de 5 MB. Tómala de nuevo o elige una más liviana.',
      );
    return new ApiError(400, 'TOO_MANY_FILES', 'Sube una foto por vez, en el campo «file».');
  }
  const type = (error as { type?: string }).type;
  if (type === 'entity.parse.failed')
    return new ApiError(400, 'VALIDATION_ERROR', 'El cuerpo del pedido no es JSON válido.');
  if (type === 'entity.too.large')
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El pedido es demasiado grande.');
  if (isDatabaseDown(error, deps.connection)) return serviceUnavailable();
  return null;
}

/** API de la capacidad «Primer paso con ahorro medido» (Express 5: los errores asíncronos llegan al manejador). */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.get('x-request-id');
    req.requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  });
  // Registros sin datos personales: método, ruta y estado; nunca cuerpos ni encabezados.
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req) => (req as unknown as Request).requestId,
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? 'error' : 'info'),
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      demoMode: deps.config.demoMode,
      database: deps.connection.readyState === 1 ? 'up' : 'down',
    });
  });

  app.use((_req, _res, next) => {
    if (deps.connection.readyState !== 1) throw serviceUnavailable();
    next();
  });
  app.use(authenticate(deps));

  app.use(firstStepRoutes(deps));
  app.use(planRoutes(deps));
  app.use(billRoutes(deps));
  app.use(savingsRoutes(deps));
  app.use(profileRoutes(deps));
  app.use(notificationRoutes(deps));
  app.use(partnerRoutes(deps));
  if (deps.config.demoMode) app.use(demoRoutes(deps));
  if (deps.config.testRoutes)
    app.get('/__test/error', () => {
      throw new Error('Detalle secreto que nunca tiene que llegar a la respuesta');
    });

  app.use((req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', `No existe la ruta ${req.method} ${req.path}.`));
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const known = toApiError(error, deps);
    if (!known) {
      req.log?.error({ err: error, requestId: req.requestId }, 'Error inesperado');
      res
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: INTERNAL_MESSAGE }, requestId: req.requestId });
      return;
    }
    res.status(known.status).json({
      error: {
        code: known.code,
        message: known.message,
        ...(known.details ? { details: known.details } : {}),
      },
      requestId: req.requestId,
    });
  });
  return app;
}
