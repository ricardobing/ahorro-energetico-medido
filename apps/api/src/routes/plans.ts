import { Router } from 'express';
import { z } from 'zod';
import { checkImplementedAt } from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { ApiError, notFound } from '../errors.js';
import { requireOwner } from '../http/auth.js';
import { ServiceError } from '../services/types.js';
import { loadBusiness, models, type PlanRecord } from '../core/common.js';
import { recomputePlan } from '../core/measurements.js';
import { trackFunnel } from '../core/notifications.js';
import { addPlanEvent, planView } from '../core/plans.js';

const PLAN_STATUSES = ['not_started', 'to_define', 'in_progress', 'delayed', 'completed', 'paused'] as const;

const patchBody = z.object({
  status: z.enum(PLAN_STATUSES).optional(),
  implementedAt: z.string().max(20).nullable().optional(),
  steps: z
    .array(
      z.object({
        _id: z.string().min(1).max(40),
        status: z.enum(['not_started', 'in_progress', 'completed']),
      }),
    )
    .max(30)
    .optional(),
});

const IMPLEMENTED_AT_MESSAGES = {
  REQUIRED: 'Para marcarlo como terminado, dinos qué día terminaste.',
  INVALID: 'Esa fecha no existe. Revisa el día y el mes.',
  FUTURE: 'La fecha no puede ser posterior a hoy.',
  TOO_OLD: 'La fecha tiene que ser de los últimos 12 meses.',
} as const;

function validImplementedAt(value: string | null | undefined, today: string): string {
  const check = checkImplementedAt(value, today);
  if (check === 'OK') return value!;
  throw new ApiError(
    422,
    check === 'REQUIRED' ? 'IMPLEMENTED_AT_REQUIRED' : 'IMPLEMENTED_AT_INVALID',
    IMPLEMENTED_AT_MESSAGES[check],
    { reason: check },
  );
}

async function ownPlan(deps: AppDeps, businessId: string, id: string): Promise<PlanRecord> {
  const plan = await models(deps).Plan.findOne({ _id: id, businessId }).lean<PlanRecord>();
  if (!plan) throw notFound('El plan');
  return plan;
}

export function planRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get('/user-eco-card', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    const plans = await models(deps)
      .Plan.find({ businessId: user.businessId })
      .sort({ createdAt: -1, _id: 1 })
      .lean<PlanRecord[]>();
    res.json({ items: await Promise.all(plans.map((p) => planView(deps, p, business.country))) });
  });

  router.get('/user-eco-card/:id', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    res.json(
      await planView(deps, await ownPlan(deps, user.businessId, req.params.id as string), business.country),
    );
  });

  router.patch('/user-eco-card/:id', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    const plan = await ownPlan(deps, user.businessId, req.params.id as string);
    const body = patchBody.parse(req.body ?? {});
    const today = deps.clock.today();
    const m = models(deps);
    const set: Partial<PlanRecord> = {};
    let measurementChanged = false;
    // Se valida antes de escribir nada: un 422 no deja eventos a medias.
    const completing = body.status === 'completed' && plan.status !== 'completed';
    const correcting =
      !body.status &&
      body.implementedAt !== undefined &&
      plan.status === 'completed' &&
      body.implementedAt !== plan.implementedAt;
    const implementedAt = completing || correcting ? validImplementedAt(body.implementedAt, today) : null;

    if (body.steps) {
      const steps = plan.steps.map((s) => ({ ...s }));
      for (const change of body.steps) {
        const step = steps.find((s) => s._id === change._id);
        if (!step) throw notFound('El paso');
        if (step.status !== change.status) {
          step.status = change.status;
          await addPlanEvent(deps, plan, {
            type: 'step_updated',
            data: { stepId: step._id, status: change.status },
          });
        }
      }
      set.steps = steps;
      set.lastStepChangeAt = today;
    }

    if (body.status && body.status !== plan.status) {
      if (completing && implementedAt) {
        set.implementedAt = implementedAt;
        measurementChanged = implementedAt !== plan.implementedAt;
        await addPlanEvent(deps, plan, {
          type: 'completed',
          from: plan.status,
          to: 'completed',
          data: { implementedAt },
        });
      } else {
        const type =
          plan.status === 'completed'
            ? 'reopened'
            : body.status === 'paused'
              ? 'paused'
              : plan.status === 'paused'
                ? 'resumed'
                : 'status_changed';
        await addPlanEvent(deps, plan, { type, from: plan.status, to: body.status });
      }
      set.status = body.status;
      set.statusUpdatedAt = today;
    } else if (correcting && implementedAt) {
      // Corrige la fecha de un plan ya terminado: cambia la medición.
      set.implementedAt = implementedAt;
      measurementChanged = true;
      await addPlanEvent(deps, plan, {
        type: 'implemented_at_changed',
        data: { from: plan.implementedAt, to: implementedAt },
      });
    }

    if (Object.keys(set).length > 0) await m.Plan.updateOne({ _id: plan._id }, { $set: set });
    const updated = { ...plan, ...set } as PlanRecord;
    if (measurementChanged) {
      await recomputePlan(deps, updated, business, plan.implementedAt ? { kind: 'plan' } : null);
      if (set.status === 'completed')
        await trackFunnel(deps, {
          type: 'plan_completed',
          businessId: plan.businessId,
          planId: plan._id,
          ecoId: plan.ecoCardOrigin,
        });
    }
    res.json(await planView(deps, updated, business.country));
  });

  /** Ideas extra para un paso, solo a pedido (no consume cupo al abrir el plan). */
  router.post('/user-eco-card/:id/steps/:stepId/ideas', async (req, res) => {
    const user = requireOwner(req);
    const plan = await ownPlan(deps, user.businessId, req.params.id as string);
    const step = plan.steps.find((s) => s._id === req.params.stepId);
    if (!step) throw notFound('El paso');
    let subSteps: string[];
    try {
      const result = await deps.services.subtasks.generate(
        { userEcoCardId: plan._id, stepsId: [step._id] },
        AbortSignal.timeout(deps.config.subtasksTimeoutMs),
      );
      subSteps = (result.steps.find((s) => s._id === step._id)?.subSteps ?? []).filter(
        (s): s is string => typeof s === 'string' && s.trim().length > 0,
      );
    } catch (error) {
      deps.logger.warn(
        { event: 'subtasks_failed', failure: error instanceof ServiceError ? error.failure : 'unknown' },
        'Falló el servicio de subtareas',
      );
      if (error instanceof ServiceError && error.failure === 'quota')
        throw new ApiError(
          402,
          'AI_QUOTA_EXCEEDED',
          'Se terminó el cupo gratis de ideas de este mes. Tus pasos siguen aquí.',
        );
      throw new ApiError(
        503,
        'AI_UNAVAILABLE',
        'Ahora no pudimos sugerir ideas extra. Tus pasos siguen aquí.',
      );
    }
    const steps = plan.steps.map((s) => (s._id === step._id ? { ...s, subSteps } : s));
    await models(deps).Plan.updateOne({ _id: plan._id }, { $set: { steps } });
    res.json({ step: { ...step, subSteps } });
  });

  return router;
}
