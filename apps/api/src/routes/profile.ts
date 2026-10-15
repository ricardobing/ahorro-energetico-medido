import { Router } from 'express';
import { z } from 'zod';
import {
  CIIU_OPTIONS,
  currencyForCountry,
  EQUIPMENT_OPTIONS,
  OVEN_OPTIONS,
  sanitizeModelSuggestions,
  suggestByKeywords,
  type ProfileSuggestions,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { ApiError } from '../errors.js';
import { requireOwner, requireUser } from '../http/auth.js';
import { ServiceError } from '../services/types.js';
import { loadBusiness, models, nowIso, type BusinessRecord } from '../core/common.js';
import { currentRecommendation } from '../core/recommendations.js';

const ciiuCodes = CIIU_OPTIONS.map((o) => o.code) as [string, ...string[]];
const equipmentValues = EQUIPMENT_OPTIONS.map((o) => o.value) as [string, ...string[]];
const ovenValues = OVEN_OPTIONS.map((o) => o.value) as [string, ...string[]];

const patchBody = z.object({
  ciiu: z.enum(ciiuCodes).nullable().optional(),
  equipment: z.array(z.enum(equipmentValues)).max(equipmentValues.length).nullable().optional(),
  ovenType: z.enum(ovenValues).optional(),
  budgetQuarterCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  hoursPerWeek: z.number().min(0).max(168).nullable().optional(),
  description: z.string().max(1000).optional(),
  employeesText: z.string().max(60).optional(),
});

const assistBody = z.object({
  description: z.string().trim().min(10, 'Cuéntanos un poco más de tu negocio.').max(1000),
  noticeAccepted: z.boolean().optional(),
});

const AI_NOTICE =
  'Tu descripción se envía a un servicio de IA solo para sugerir estos datos. No escribas nombres ni teléfonos.';

export function profileView(b: BusinessRecord) {
  const ciiu = CIIU_OPTIONS.find((o) => o.code === b.ciiu);
  return {
    name: b.name,
    ownerName: b.ownerName ?? null,
    country: b.country,
    city: b.city ?? null,
    currency: currencyForCountry(b.country),
    ciiu: ciiu ? { code: ciiu.code, label: ciiu.label } : null,
    employeesText: b.employeesText ?? null,
    description: b.description ?? null,
    equipment: b.equipment ?? null,
    ovenType: b.ovenType ?? 'unknown',
    budgetQuarterCents: b.constraints?.budgetQuarterCents ?? null,
    hoursPerWeek: b.constraints?.hoursPerWeek ?? null,
    diagnosticLevel: b.diagnostic?.level ?? null,
    dataSource: b.dataSource,
  };
}

type Outcome = 'ai' | 'keywords_disabled' | 'keywords_limit' | 'keywords_timeout' | 'keywords_error';

export function profileRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get('/me', async (req, res) => {
    const user = requireUser(req);
    const business = user.businessId ? await loadBusiness(deps, user.businessId) : null;
    res.json({
      user: { id: user.id, role: user.role, displayName: user.displayName },
      business: business
        ? { name: business.name, country: business.country, city: business.city ?? null }
        : null,
      today: deps.clock.today(),
      demoMode: deps.config.demoMode,
    });
  });

  router.get('/profile', async (req, res) => {
    const user = requireOwner(req);
    res.json(profileView(await loadBusiness(deps, user.businessId)));
  });

  /** Confirma lo que la usuaria revisó (sugerido o escrito a mano) y recalcula la recomendación. */
  router.patch('/profile', async (req, res) => {
    const user = requireOwner(req);
    const body = patchBody.parse(req.body ?? {});
    const set: Record<string, unknown> = {};
    if (body.ciiu !== undefined) set.ciiu = body.ciiu;
    if (body.equipment !== undefined) set.equipment = body.equipment;
    if (body.ovenType !== undefined) set.ovenType = body.ovenType;
    if (body.budgetQuarterCents !== undefined)
      set['constraints.budgetQuarterCents'] = body.budgetQuarterCents;
    if (body.hoursPerWeek !== undefined) set['constraints.hoursPerWeek'] = body.hoursPerWeek;
    if (body.description !== undefined) set.description = body.description;
    if (body.employeesText !== undefined) set.employeesText = body.employeesText;
    if (Object.keys(set).length > 0)
      await models(deps).Business.updateOne({ _id: user.businessId }, { $set: set });
    await currentRecommendation(deps, user.businessId);
    res.json(profileView(await loadBusiness(deps, user.businessId)));
  });

  /**
   * Perfil asistido (D13): el modelo elige de listas cerradas y el dominio verifica cada valor contra el
   * texto. Nada se guarda hasta que la usuaria confirma con `PATCH /profile`. El texto nunca va a los registros.
   */
  router.post('/profile/assist', async (req, res) => {
    const user = requireOwner(req);
    const body = assistBody.parse(req.body ?? {});
    const m = models(deps);
    const business = await loadBusiness(deps, user.businessId);
    if (!business.aiNoticeAcceptedAt) {
      if (!body.noticeAccepted) throw new ApiError(409, 'AI_NOTICE_REQUIRED', AI_NOTICE);
      await m.Business.updateOne({ _id: business._id }, { $set: { aiNoticeAcceptedAt: nowIso(deps) } });
    }

    const started = Date.now();
    const model = deps.services.profileModel;
    let suggestions: ProfileSuggestions | null = null;
    let outcome: Outcome = 'keywords_disabled';
    let notice: string | null = null;
    if (deps.config.profileAssist.enabled && model) {
      const usageId = `${business._id}:${deps.clock.today()}`;
      // Un solo paso atómico: suma 1 si queda cupo; si el cupo se agotó, el upsert choca con el documento existente.
      const allowed = await m.AiUsage.findOneAndUpdate(
        { _id: usageId, count: { $lt: deps.config.profileAssist.maxRequestsPerDay } },
        { $inc: { count: 1 } },
        { upsert: true, new: true },
      ).catch((error: unknown) => {
        if ((error as { code?: number }).code === 11000) return null;
        throw error;
      });
      if (!allowed) {
        outcome = 'keywords_limit';
        notice = 'Por hoy te sugerimos sin IA.';
      } else {
        try {
          const raw = await model.suggest(
            body.description,
            AbortSignal.timeout(deps.config.profileAssist.timeoutMs),
          );
          suggestions = sanitizeModelSuggestions(raw, body.description, business.country);
          outcome = 'ai';
        } catch (error) {
          outcome =
            error instanceof ServiceError && error.failure === 'timeout'
              ? 'keywords_timeout'
              : 'keywords_error';
        }
      }
    }
    suggestions ??= suggestByKeywords(body.description, business.country);
    deps.logger.info(
      {
        event: 'profile_assist',
        model: model?.modelName ?? null,
        outcome: outcome === 'ai' ? 'ai' : outcome,
        durationMs: Date.now() - started,
      },
      'Perfil asistido',
    );
    res.json({ suggestions, ...(notice ? { notice } : {}) });
  });

  return router;
}
