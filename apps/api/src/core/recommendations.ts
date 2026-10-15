import {
  daysWithoutChange,
  explainRecommendation,
  isStalled,
  normalizeBill,
  recommend,
  relativeSigmaPct,
  shiftYears,
  compareDates,
  RULESET_VERSION,
  type PeerStat,
  type RankedEco,
  type RecommendationResult,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { ApiError, notFound } from '../errors.js';
import {
  businessForRecommendation,
  loadBusiness,
  loadCatalog,
  loadElectricityBills,
  models,
  newId,
  nowIso,
  sha256,
  type BusinessRecord,
  type EcoRecord,
  type PlanRecord,
} from './common.js';
import { notify, trackFunnel } from './notifications.js';
import { addPlanEvent, planView } from './plans.js';

export interface StoredRecommendation {
  _id: string;
  businessId: string;
  status: 'current' | 'superseded';
  ecoId: string | null;
  ranked: RankedEco[];
  excluded: RecommendationResult['excluded'];
  inputs: Record<string, unknown> & { peerStatsVersion: string };
  rulesetVersion: string;
  inputsHash: string;
  lastInputsHash?: string;
  signature: string;
  decision: { type: 'accepted' | 'chose_alternative'; ecoId: string; planId: string; at: string } | null;
  createdAt: string;
  shownAt: string | null;
}

/** Versión vigente de las estadísticas de pares y las filas del sector. */
export async function currentPeerStats(
  deps: AppDeps,
  sector: string | null,
): Promise<{ version: string; stats: PeerStat[] }> {
  const m = models(deps);
  const setting = await m.Setting.findById('peerStatsVersion').lean<{ value: string }>();
  const version = setting?.value ?? 'none';
  const rows = sector ? await m.PeerStat.find({ version, sector }).lean<PeerStat[]>() : [];
  return {
    version,
    stats: rows.map(({ ecoId, chose, completed, measuredCount, medianChangePct }) => ({
      ecoId,
      chose,
      completed,
      measuredCount,
      medianChangePct: medianChangePct ?? null,
    })),
  };
}

/** Variación propia de los últimos 12 meses (o `null` con menos de 4 facturas: se usa la de por defecto). */
function ownSigma(bills: Awaited<ReturnType<typeof loadElectricityBills>>, today: string): number | null {
  const since = shiftYears(today, -1);
  const recent = bills.filter((b) => compareDates(b.billingStartDate, since) >= 0);
  if (recent.length < 4) return null;
  return Math.round(relativeSigmaPct(recent.map((b) => normalizeBill(b).kwhPerDay)) * 10_000) / 10_000;
}

interface Snapshot {
  business: BusinessRecord;
  catalog: EcoRecord[];
  peers: PeerStat[];
  plans: PlanRecord[];
  billsCount: number;
  inputs: StoredRecommendation['inputs'];
  inputsHash: string;
}

async function snapshot(deps: AppDeps, businessId: string): Promise<Snapshot> {
  const business = await loadBusiness(deps, businessId);
  const [catalog, peerStats, plans, bills] = await Promise.all([
    loadCatalog(deps),
    currentPeerStats(deps, business.ciiu),
    models(deps).Plan.find({ businessId }).sort({ _id: 1 }).lean<PlanRecord[]>(),
    loadElectricityBills(deps, businessId),
  ]);
  const inputs = {
    ...businessForRecommendation(business),
    plans: plans.map((p) => ({ ecoId: p.ecoCardOrigin, status: p.status })),
    sigmaPct: ownSigma(bills, deps.clock.today()),
    billsCount: bills.length,
    peerStatsVersion: peerStats.version,
    catalog: catalog.map((e) => e.id),
    rulesetVersion: RULESET_VERSION,
  };
  return {
    business,
    catalog,
    peers: peerStats.stats,
    plans,
    billsCount: bills.length,
    inputs,
    inputsHash: sha256(inputs),
  };
}

const signatureOf = (r: RecommendationResult) =>
  sha256({
    chosen: r.chosenEcoId,
    ranked: r.ranked.map((x) => x.ecoId),
    excluded: r.excluded.map((x) => [x.ecoId, [...x.reasons].sort()]),
  });

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/**
 * Recomendación vigente del negocio. Se recalcula solo si cambiaron las entradas; si el resultado es el
 * mismo, se conserva (mismo id y fecha). Una vez que la usuaria decidió, queda fija.
 */
export async function currentRecommendation(
  deps: AppDeps,
  businessId: string,
): Promise<{ rec: StoredRecommendation; snap: Snapshot }> {
  const m = models(deps);
  const snap = await snapshot(deps, businessId);
  const current = await m.Recommendation.findOne({
    businessId,
    status: 'current',
  }).lean<StoredRecommendation>();
  if (
    current &&
    (current.decision || current.lastInputsHash === snap.inputsHash || current.inputsHash === snap.inputsHash)
  )
    return { rec: current, snap };

  const result = recommend({
    business: businessForRecommendation(snap.business),
    catalog: snap.catalog,
    peers: snap.peers,
    plans: snap.plans.map((p) => ({ ecoId: p.ecoCardOrigin, status: p.status })),
    sigmaPct: snap.inputs.sigmaPct as number | null,
  });
  const signature = signatureOf(result);
  if (current && current.signature === signature) {
    await m.Recommendation.updateOne({ _id: current._id }, { $set: { lastInputsHash: snap.inputsHash } });
    return { rec: { ...current, lastInputsHash: snap.inputsHash }, snap };
  }

  const rec: StoredRecommendation = {
    _id: newId('rec'),
    businessId,
    status: 'current',
    ecoId: result.chosenEcoId,
    ranked: result.ranked,
    excluded: result.excluded,
    inputs: snap.inputs,
    rulesetVersion: result.rulesetVersion,
    inputsHash: snap.inputsHash,
    lastInputsHash: snap.inputsHash,
    signature,
    decision: null,
    createdAt: nowIso(deps),
    shownAt: null,
  };
  if (current) await m.Recommendation.updateOne({ _id: current._id }, { $set: { status: 'superseded' } });
  try {
    await m.Recommendation.create(rec);
  } catch (error) {
    // Otra consulta simultánea ya guardó la vigente: se usa esa.
    if (!isDuplicateKey(error)) throw error;
    const winner = await m.Recommendation.findOne({
      businessId,
      status: 'current',
    }).lean<StoredRecommendation>();
    return { rec: winner!, snap };
  }
  if (current && current.ecoId !== rec.ecoId && rec.ecoId) {
    const eco = snap.catalog.find((e) => e.id === rec.ecoId);
    await notify(deps, {
      businessId,
      type: 'recommendation_changed',
      title: 'Tu primer paso cambió',
      body: `Con tus datos nuevos te recomendamos «${eco?.title ?? rec.ecoId}».`,
      link: '/',
    });
  }
  return { rec, snap };
}

function ecoSummary(eco: EcoRecord | undefined) {
  if (!eco) return null;
  return {
    ecoId: eco.id,
    title: eco.title,
    category: eco.category,
    complexity: eco.complexity,
    investment: eco.investment,
    time: eco.time,
    collaborators: eco.collaborators,
    impact: eco.impact,
    returnInvestment: eco.returnInvestment,
    steps: eco.steps,
    dataSource: eco.dataSource ?? null,
  };
}

/** Lo que ve la usuaria en «Tu primer paso»: la recomendación, por qué, alternativas y el plan estancado. */
export async function firstStepView(deps: AppDeps, businessId: string, opts: { markShown: boolean }) {
  const { rec, snap } = await currentRecommendation(deps, businessId);
  const result: RecommendationResult = {
    rulesetVersion: rec.rulesetVersion,
    chosenEcoId: rec.ecoId,
    ranked: rec.ranked,
    excluded: rec.excluded,
  };
  const explanation = explainRecommendation(result, {
    catalog: snap.catalog,
    peers: snap.peers,
    business: businessForRecommendation(snap.business),
    billsCount: snap.billsCount,
  });
  const chosen = rec.ranked.find((r) => r.ecoId === rec.ecoId);
  const peer = snap.peers.find((p) => p.ecoId === rec.ecoId);
  const today = deps.clock.today();
  const stalled = snap.plans.find((p) =>
    isStalled({ status: p.status, lastStepChangeAt: p.lastStepChangeAt ?? p.statusUpdatedAt }, today),
  );

  if (opts.markShown && !rec.shownAt) {
    await models(deps).Recommendation.updateOne({ _id: rec._id }, { $set: { shownAt: nowIso(deps) } });
    await trackFunnel(deps, { type: 'recommendation_shown', businessId, ecoId: rec.ecoId ?? undefined });
  }

  return {
    recommendation: rec.ecoId
      ? {
          id: rec._id,
          ecoId: rec.ecoId,
          createdAt: rec.createdAt,
          rulesetVersion: rec.rulesetVersion,
          eco: ecoSummary(snap.catalog.find((e) => e.id === rec.ecoId)),
        }
      : null,
    explanation,
    alternatives: rec.ranked
      .filter((r) => r.ecoId !== rec.ecoId)
      .map((r) => {
        const eco = snap.catalog.find((e) => e.id === r.ecoId);
        return {
          ecoId: r.ecoId,
          title: eco?.title ?? r.ecoId,
          investment: eco?.investment,
          time: eco?.time,
          complexity: eco?.complexity,
          budgetFit: r.factors.budgetFit,
          mayExceedBudget: r.reasons.includes('MAY_EXCEED_BUDGET'),
        };
      }),
    why: chosen
      ? {
          peerCounts: {
            chose: peer?.chose ?? 0,
            completed: peer?.completed ?? 0,
            measured: peer?.measuredCount ?? 0,
          },
          factors: chosen.factors,
          dataUsed: {
            budgetCents: snap.inputs.budgetCents,
            hoursPerWeek: snap.inputs.hoursPerWeek,
            diagnosticLevel: snap.inputs.diagnosticLevel,
            equipment: snap.inputs.equipment,
            ovenType: snap.inputs.ovenType,
            billsCount: snap.billsCount,
            peerStatsVersion: rec.inputs.peerStatsVersion,
          },
          rulesetVersion: rec.rulesetVersion,
        }
      : null,
    stalledPlan: stalled
      ? {
          id: stalled._id,
          title: stalled.title,
          daysWithoutChange: daysWithoutChange(
            { status: stalled.status, lastStepChangeAt: stalled.lastStepChangeAt ?? stalled.statusUpdatedAt },
            today,
          ),
        }
      : null,
    decision: rec.decision,
  };
}

/** Acepta la recomendación o elige otra alternativa elegible; crea el plan con los pasos del catálogo. */
export async function decide(
  deps: AppDeps,
  businessId: string,
  body: { action: 'accept' | 'choose'; ecoId?: string; pausePlanId?: string },
) {
  const m = models(deps);
  const { rec, snap } = await currentRecommendation(deps, businessId);
  if (rec.decision)
    throw new ApiError(409, 'ALREADY_DECIDED', 'Ya elegiste tu primer paso. Lo ves en «Tu plan».');
  const ecoId = body.action === 'accept' ? rec.ecoId : body.ecoId;
  if (!ecoId || !rec.ranked.some((r) => r.ecoId === ecoId))
    throw new ApiError(409, 'NOT_ELIGIBLE', 'Esa ecoinnovación no está disponible para tu negocio ahora.');
  const eco = snap.catalog.find((e) => e.id === ecoId)!;

  let pausedPlan: PlanRecord | null = null;
  if (body.pausePlanId) {
    const toPause = await m.Plan.findOne({ _id: body.pausePlanId, businessId }).lean<PlanRecord>();
    if (!toPause) throw notFound('El plan');
    if (!['in_progress', 'delayed', 'not_started', 'to_define'].includes(toPause.status))
      throw new ApiError(409, 'PLAN_NOT_PAUSABLE', 'Ese plan no se puede pausar ahora.');
    await m.Plan.updateOne(
      { _id: toPause._id },
      { $set: { status: 'paused', statusUpdatedAt: deps.clock.today() } },
    );
    await addPlanEvent(deps, toPause, { type: 'paused', from: toPause.status, to: 'paused' });
    pausedPlan = { ...toPause, status: 'paused', statusUpdatedAt: deps.clock.today() };
  }

  const today = deps.clock.today();
  const plan: PlanRecord = {
    _id: newId('plan'),
    businessId,
    ecoCardOrigin: eco.id,
    title: eco.title,
    status: 'in_progress',
    statusUpdatedAt: today,
    createdAt: today,
    lastStepChangeAt: today,
    steps: eco.steps.map((title, i) => ({
      _id: `step_${i + 1}`,
      title,
      status: 'not_started',
      subSteps: [],
    })),
    implementedAt: null,
  };
  await m.Plan.create(plan);
  await addPlanEvent(deps, plan, { type: 'created', to: 'in_progress', data: { ecoId: eco.id } });
  const decision = {
    type: body.action === 'accept' ? ('accepted' as const) : ('chose_alternative' as const),
    ecoId: eco.id,
    planId: plan._id,
    at: nowIso(deps),
  };
  await m.Recommendation.updateOne({ _id: rec._id }, { $set: { decision } });
  await trackFunnel(deps, {
    type: body.action === 'accept' ? 'recommendation_accepted' : 'recommendation_changed',
    businessId,
    ecoId: eco.id,
    planId: plan._id,
  });

  return {
    plan: await planView(deps, plan, snap.business.country),
    pausedPlan: pausedPlan ? await planView(deps, pausedPlan, snap.business.country) : null,
  };
}

/** Correo de bienvenida armado con la misma recomendación y los mismos motivos que la app. */
export function welcomeEmail(title: string, reasons: string[], unknown: string) {
  return {
    subject: `Tu primer paso en Kamai: ${title}`,
    paragraphs: [`Te recomendamos empezar por «${title}».`, ...reasons, unknown],
  };
}
