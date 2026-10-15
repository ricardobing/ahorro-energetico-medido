import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { notFound, unauthenticated } from '../errors.js';
import { requireOwner, requireStaff } from '../http/auth.js';
import { models, nowIso } from '../core/common.js';
import { notify } from '../core/notifications.js';

const bounceBody = z.object({ email: z.string().email().max(200), reason: z.string().max(100).optional() });

export function notificationRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get('/notifications', async (req, res) => {
    const user = requireOwner(req);
    const items = await models(deps)
      .Notification.find({ businessId: user.businessId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();
    res.json({
      items: items.map((n) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link ?? null,
        createdAt: n.createdAt,
        readAt: n.readAt ?? null,
      })),
      unread: items.filter((n) => !n.readAt).length,
    });
  });

  router.post('/notifications/:id/read', async (req, res) => {
    const user = requireOwner(req);
    const result = await models(deps)
      .Notification.updateOne(
        { _id: req.params.id, businessId: user.businessId },
        { $set: { readAt: nowIso(deps) } },
      )
      .catch(() => ({ matchedCount: 0 }));
    if (result.matchedCount === 0) throw notFound('El aviso');
    res.status(204).end();
  });

  /** Aviso de rebote del servicio de mensajería: suprime la dirección y cancela lo pendiente. */
  router.post('/webhooks/messaging/bounce', async (req, res) => {
    if (req.get('x-api-key') !== deps.config.messaging.apiKey) throw unauthenticated();
    const { email } = bounceBody.parse(req.body ?? {});
    const address = email.toLowerCase();
    const m = models(deps);
    await m.Suppression.updateOne(
      { _id: address },
      { $set: { reason: 'bounce', at: nowIso(deps) } },
      { upsert: true },
    );
    const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const to = { $regex: `^${escaped}$`, $options: 'i' };
    await m.Outbox.updateMany(
      { to, status: { $in: ['pending', 'sending', 'failed'] } },
      { $set: { status: 'suppressed' } },
    );
    await m.Outbox.updateMany({ to, status: 'sent' }, { $set: { status: 'bounced' } });
    const owners = await m.User.find({ email: to, role: 'owner' }).lean();
    for (const owner of owners)
      if (owner.businessId)
        await notify(deps, {
          businessId: owner.businessId,
          type: 'email_bounced',
          title: 'Revisa tu correo',
          body: 'No pudimos escribirte a tu correo. Revisa que esté bien escrito.',
          link: '/mas/perfil',
          dedupeKey: `email_bounced:${owner._id}:${deps.clock.today()}`,
        });
    res.status(204).end();
  });

  router.get('/audit/outbox', async (req, res) => {
    requireStaff(req);
    const filter = typeof req.query.businessId === 'string' ? { businessId: req.query.businessId } : {};
    const items = await models(deps).Outbox.find(filter).sort({ createdAt: 1, _id: 1 }).limit(200).lean();
    res.json({
      items: items.map((i) => ({
        id: String(i._id),
        template: i.template,
        ref: i.ref,
        subject: i.subject,
        status: i.status,
        attempts: i.attempts,
        nextAttemptAt: i.nextAttemptAt ? new Date(i.nextAttemptAt).toISOString() : null,
        lastError: i.lastError ?? null,
        sentAt: i.sentAt ?? null,
      })),
    });
  });

  router.get('/audit/funnel-events', async (req, res) => {
    requireStaff(req);
    const filter = typeof req.query.businessId === 'string' ? { businessId: req.query.businessId } : {};
    const items = await models(deps).FunnelEvent.find(filter).sort({ at: 1, _id: 1 }).limit(500).lean();
    res.json({
      items: items.map((e) => ({
        type: e.type,
        at: e.at,
        businessId: e.businessId,
        ecoId: e.ecoId ?? null,
        planId: e.planId ?? null,
        data: e.data ?? null,
      })),
    });
  });

  return router;
}
