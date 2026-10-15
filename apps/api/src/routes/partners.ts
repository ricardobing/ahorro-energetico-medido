import { Router } from 'express';
import type { AppDeps } from '../app.js';
import { requirePartnerOrStaff, requireStaff } from '../http/auth.js';
import { closePartnerReport, parsePeriod, partnerReport } from '../core/partners.js';

export function partnerRoutes(deps: AppDeps): Router {
  const router = Router();

  /** Informe agregado para aliados (rol aliado o equipo): nunca identifica a un negocio. */
  router.get('/partners/report', async (req, res) => {
    requirePartnerOrStaff(req);
    res.json(await partnerReport(deps, parsePeriod(req.query.period)));
  });

  /** Cierra el periodo (solo el equipo de Kamai): el informe queda inmutable. */
  router.post('/partners/report/:period/close', async (req, res) => {
    requireStaff(req);
    res.json(await closePartnerReport(deps, parsePeriod(req.params.period)));
  });

  return router;
}
