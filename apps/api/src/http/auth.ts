import type { NextFunction, Request, Response } from 'express';
import type { AppDeps } from '../app.js';
import { getModels } from '../db/models.js';
import { forbidden, unauthenticated } from '../errors.js';

export type Role = 'owner' | 'partner' | 'staff';

export interface SessionUser {
  id: string;
  role: Role;
  businessId: string | null;
  displayName: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    user?: SessionUser;
  }
}

/**
 * Adaptador de autenticación (D20). En Kamai, este middleware verifica el token de Firebase y resuelve el
 * negocio. En local, con `DEMO_MODE=true`, acepta `X-Demo-User` (ines, nuevo, aliado o equipo).
 */
export function authenticate(deps: AppDeps) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const demoKey = req.get('x-demo-user');
    if (deps.config.demoMode && demoKey) {
      const user = await getModels(deps.connection).User.findOne({ demoKey }).lean();
      if (user)
        req.user = {
          id: user._id,
          role: user.role as Role,
          businessId: user.businessId ?? null,
          displayName: user.displayName ?? user._id,
        };
    }
    next();
  };
}

export function requireUser(req: Request): SessionUser {
  if (!req.user) throw unauthenticated();
  return req.user;
}

/** Rutas de un negocio: solo la dueña. El negocio sale de la sesión, nunca del cuerpo del pedido. */
export function requireOwner(req: Request): SessionUser & { businessId: string } {
  const user = requireUser(req);
  if (user.role !== 'owner' || !user.businessId) throw forbidden();
  return user as SessionUser & { businessId: string };
}

export function requireStaff(req: Request): SessionUser {
  const user = requireUser(req);
  if (user.role !== 'staff') throw forbidden();
  return user;
}

export function requirePartnerOrStaff(req: Request): SessionUser {
  const user = requireUser(req);
  if (user.role !== 'partner' && user.role !== 'staff') throw forbidden();
  return user;
}
