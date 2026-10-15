import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { notFound } from '../errors.js';
import { requireOwner, requireStaff } from '../http/auth.js';
import { loadCatalog, models } from '../core/common.js';
import { emailHtml } from '../core/notifications.js';
import {
  currentRecommendation,
  decide,
  firstStepView,
  welcomeEmail,
  type StoredRecommendation,
} from '../core/recommendations.js';

const decisionBody = z.object({
  action: z.enum(['accept', 'choose']),
  ecoId: z.string().min(1).max(60).optional(),
  pausePlanId: z.string().min(1).max(60).optional(),
});

export function firstStepRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get('/first-step', async (req, res) => {
    const user = requireOwner(req);
    res.json(await firstStepView(deps, user.businessId, { markShown: true }));
  });

  router.post('/first-step/decision', async (req, res) => {
    const user = requireOwner(req);
    const body = decisionBody.parse(req.body ?? {});
    res.status(201).json(await decide(deps, user.businessId, body));
  });

  /** Catálogo con la recomendación vigente fijada arriba: la misma que en «Tu primer paso». */
  router.get('/catalog', async (req, res) => {
    const user = requireOwner(req);
    const { rec } = await currentRecommendation(deps, user.businessId);
    const catalog = await loadCatalog(deps);
    const excluded = new Map(rec.excluded.map((e) => [e.ecoId, e.reasons]));
    const pinned = catalog.find((e) => e.id === rec.ecoId);
    res.json({
      pinned: pinned ? { ecoId: pinned.id, title: pinned.title, recommendationId: rec._id } : null,
      items: catalog.map((e) => ({
        ecoId: e.id,
        title: e.title,
        category: e.category,
        complexity: e.complexity,
        investment: e.investment,
        time: e.time,
        impact: e.impact,
        eligible: !excluded.has(e.id),
        excludedReasons: excluded.get(e.id) ?? [],
        pinned: e.id === rec.ecoId,
        dataSource: e.dataSource ?? null,
      })),
    });
  });

  /** Diagnóstico por etapas: los tres primeros de la misma recomendación vigente. */
  router.get('/diagnostic/recommendations', async (req, res) => {
    const user = requireOwner(req);
    const { rec } = await currentRecommendation(deps, user.businessId);
    const catalog = await loadCatalog(deps);
    res.json({
      recommendationId: rec._id,
      items: rec.ranked.slice(0, 3).map((r) => ({
        ecoId: r.ecoId,
        title: catalog.find((e) => e.id === r.ecoId)?.title ?? r.ecoId,
      })),
    });
  });

  router.get('/welcome-email/preview', async (req, res) => {
    const user = requireOwner(req);
    const view = await firstStepView(deps, user.businessId, { markShown: false });
    const title = view.recommendation?.eco?.title ?? 'tu primer paso';
    const email = welcomeEmail(title, view.explanation.reasons, view.explanation.unknown);
    res.json({
      subject: email.subject,
      html: emailHtml(email.subject, email.paragraphs, { label: 'Ver mi primer paso', href: '/' }),
    });
  });

  router.get('/audit/businesses/:id/recommendation', async (req, res) => {
    requireStaff(req);
    const m = models(deps);
    const all = await m.Recommendation.find({ businessId: req.params.id })
      .sort({ createdAt: 1, _id: 1 })
      .lean<StoredRecommendation[]>();
    const current = all.find((r) => r.status === 'current');
    if (!current) throw notFound('La recomendación');
    const view = ({ _id, ...r }: StoredRecommendation) => ({ id: _id, ...r });
    res.json({
      current: view(current),
      history: all.map((r) => ({ id: r._id, status: r.status, ecoId: r.ecoId, createdAt: r.createdAt })),
    });
  });

  return router;
}
