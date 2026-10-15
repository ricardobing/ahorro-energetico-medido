import type { AppDeps } from '../app.js';
import { models, nowIso } from './common.js';

export type NotificationType =
  'bill_reminder' | 'email_bounced' | 'savings_recalculated' | 'recommendation_changed' | 'measurement_ready';

export interface NotifyInput {
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Si se repite, el aviso no se duplica. */
  dedupeKey?: string;
}

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/** Crea el aviso dentro de la app (canal principal, D12). Devuelve `false` si ya existía. */
export async function notify(deps: AppDeps, input: NotifyInput): Promise<boolean> {
  try {
    await models(deps).Notification.create({ ...input, createdAt: nowIso(deps), readAt: null });
    return true;
  } catch (error) {
    if (input.dedupeKey && isDuplicateKey(error)) return false;
    throw error;
  }
}

export interface EmailInput {
  businessId: string;
  template: string;
  /** Referencia que distingue envíos de la misma plantilla (el periodo del recordatorio, por ejemplo). */
  ref: string;
  subject: string;
  html: string;
}

/**
 * Encola un correo para la dueña del negocio, una sola vez por (persona, plantilla, referencia) (D11).
 * Si la dirección rebotó antes, queda suprimido sin intentar.
 */
export async function enqueueEmail(deps: AppDeps, input: EmailInput): Promise<void> {
  const m = models(deps);
  const owner = await m.User.findOne({ businessId: input.businessId, role: 'owner' }).lean();
  if (!owner?.email) return;
  const suppressed = await m.Suppression.exists({ _id: owner.email.toLowerCase() });
  try {
    await m.Outbox.create({
      idempotencyKey: `${owner._id}:${input.template}:${input.ref}`,
      businessId: input.businessId,
      userId: owner._id,
      to: owner.email,
      template: input.template,
      ref: input.ref,
      subject: input.subject,
      html: input.html,
      status: suppressed ? 'suppressed' : 'pending',
      attempts: 0,
      nextAttemptAt: deps.clock.now(),
      createdAt: nowIso(deps),
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
}

export type FunnelEventType =
  | 'recommendation_shown'
  | 'recommendation_accepted'
  | 'recommendation_changed'
  | 'plan_completed'
  | 'after_bill_uploaded'
  | 'measurement_result';

/** Evento del embudo, sin datos personales: solo el identificador interno del negocio (D: eventos de la meta). */
export async function trackFunnel(
  deps: AppDeps,
  event: {
    type: FunnelEventType;
    businessId: string;
    ecoId?: string;
    planId?: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await models(deps).FunnelEvent.create({ ...event, at: nowIso(deps) });
}

/** HTML mínimo y legible de los correos, con los mismos textos que la app. */
export function emailHtml(
  title: string,
  paragraphs: string[],
  cta?: { label: string; href: string },
): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${escape(p)}</p>`).join('');
  const button = cta
    ? `<p><a href="${escape(cta.href)}" style="background:#143938;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">${escape(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#0F2F2F;line-height:1.5"><h1 style="font-size:20px">${escape(title)}</h1>${body}${button}<p style="color:#3B5E5E;font-size:12px">Kamai · Prototipo para el reto técnico de Agora</p></body></html>`;
}
