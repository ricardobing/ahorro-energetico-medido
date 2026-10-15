import { Router } from 'express';
import { z } from 'zod';
import { addDays, compareDates } from '@ppam/domain';
import { DEMO_TODAY, DEMO_USERS, INES, INES_BILLS_SIMULATED } from '@ppam/fixtures';
import type { AppDeps } from '../app.js';
import { ApiError } from '../errors.js';
import { models } from '../core/common.js';
import { recomputeBusiness } from '../core/measurements.js';
import { trackFunnel } from '../core/notifications.js';
import { seedDemoData, simulatedBillDocs } from '../seed/index.js';
import { processOutbox, recomputePeerStats, scheduleBillReminders } from '../workers/index.js';

/** Lo que el servidor de demostración le presta a estas rutas (no existe en producción). */
export interface DemoControls {
  setToday(date: string): Promise<void>;
  mocksControlUrl: string | null;
}

const simulateBody = z.object({ through: z.enum(['jul', 'ago', 'sep']).optional() });
const mocksBody = z.object({
  service: z.enum(['messaging', 'subtasks', 'currency']),
  mode: z.string().min(1).max(20),
  delayMs: z.number().int().min(0).max(60_000).optional(),
});

const MONTHS = { jul: 1, ago: 2, sep: 3 } as const;

/**
 * Rutas del modo demostración (solo con `DEMO_MODE=true`, que la API se niega a usar en producción):
 * reinicio de la carga, «Simular el paso del tiempo», modos de falla y bandeja de correos.
 */
export function demoRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get('/demo/state', async (_req, res) => {
    const m = models(deps);
    const simulated = await m.Bill.countDocuments({
      _id: { $in: INES_BILLS_SIMULATED.map((b) => b.id) },
      deletedAt: null,
    });
    res.json({
      today: deps.clock.today(),
      users: Object.entries(DEMO_USERS).map(([key, u]) => ({
        key,
        role: u.role,
        displayName: u.displayName,
      })),
      simulatedMonths: simulated,
    });
  });

  router.post('/demo/reset', async (_req, res) => {
    await seedDemoData(deps.connection);
    await deps.demo?.setToday(DEMO_TODAY);
    if (deps.demo?.mocksControlUrl)
      await fetch(`${deps.demo.mocksControlUrl}/reset`, { method: 'POST' }).catch(() => undefined);
    res.status(204).end();
  });

  /** Llegan las facturas sintéticas de Inés (julio a septiembre, o hasta el mes pedido) y avanza el reloj. */
  router.post('/demo/simulate-time', async (req, res) => {
    const { through = 'sep' } = simulateBody.parse(req.body ?? {});
    const m = models(deps);
    const docs = simulatedBillDocs(MONTHS[through]);
    for (const doc of docs) {
      const exists = await m.Bill.exists({ _id: doc._id });
      const overlap = await m.Bill.exists({
        businessId: INES.id,
        serviceType: 'electricity',
        deletedAt: null,
        billingStartDate: { $lte: doc.billingEndDate },
        billingEndDate: { $gte: doc.billingStartDate },
      });
      if (exists || overlap) continue;
      await m.Bill.create(doc);
      const after = await m.Plan.findOne({
        businessId: INES.id,
        implementedAt: { $ne: null, $lt: doc.billingStartDate },
      }).lean();
      if (after)
        await trackFunnel(deps, {
          type: 'after_bill_uploaded',
          businessId: INES.id,
          planId: after._id,
          ecoId: after.ecoCardOrigin,
        });
    }
    const lastEnd = docs.at(-1)!.billingEndDate;
    const target = addDays(lastEnd, 5);
    if (compareDates(deps.clock.today(), target) < 0) await deps.demo?.setToday(target);
    await recomputeBusiness(deps, INES.id, { kind: 'bill_created' });
    res.json({ today: deps.clock.today(), added: docs.map((d) => d.billingStartDate.slice(0, 7)) });
  });

  router.post('/demo/run-workers', async (_req, res) => {
    const reminders = await scheduleBillReminders(deps);
    const outbox = await processOutbox(deps);
    res.json({ reminders, outbox });
  });

  router.post('/demo/peer-stats', async (_req, res) => {
    res.json(await recomputePeerStats(deps));
  });

  /** Modos de falla de las simulaciones (mensajería, subtareas, moneda), desde el panel. */
  router.post('/demo/mocks', async (req, res) => {
    const body = mocksBody.parse(req.body ?? {});
    if (!deps.demo?.mocksControlUrl)
      throw new ApiError(409, 'MOCKS_UNAVAILABLE', 'Las simulaciones no están configuradas.');
    const result = await fetch(deps.demo.mocksControlUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!result || !result.ok)
      throw new ApiError(
        502,
        'MOCKS_UNAVAILABLE',
        'No pudimos cambiar el modo de la simulación. ¿Está corriendo?',
      );
    res.status(204).end();
  });

  router.get('/demo/mocks', async (_req, res) => {
    if (!deps.demo?.mocksControlUrl) {
      res.json({ available: false });
      return;
    }
    const state = await fetch(deps.demo.mocksControlUrl)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    res.json({ available: state !== null, state });
  });

  /** Bandeja de correos de la demostración: lo que la app intentó mandar y cómo terminó. */
  router.get('/demo/outbox', async (_req, res) => {
    const items = await models(deps).Outbox.find().sort({ createdAt: -1, _id: -1 }).limit(50).lean();
    res.json({
      items: items.map((i) => ({
        id: String(i._id),
        to: i.to,
        subject: i.subject,
        html: i.html,
        status: i.status,
        attempts: i.attempts,
        createdAt: i.createdAt,
      })),
    });
  });

  return router;
}
