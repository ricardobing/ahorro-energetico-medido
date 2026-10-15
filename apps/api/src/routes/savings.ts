import { Router } from 'express';
import { formatPercentInt, normalizeBill, type MeasurementResult } from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { notFound } from '../errors.js';
import { requireOwner, requireStaff } from '../http/auth.js';
import {
  loadBusiness,
  loadElectricityBills,
  models,
  nowIso,
  type BillRecord,
  type BusinessRecord,
  type PlanRecord,
} from '../core/common.js';
import { actionPhraseFor, displayFor, recomputePlan, type StoredMeasurement } from '../core/measurements.js';

/** Puntos del gráfico de kWh por día: cada factura con su papel en la comparación. */
async function chartOf(deps: AppDeps, businessId: string, result: MeasurementResult) {
  const bills = await loadElectricityBills(deps, businessId);
  const baseline = new Set(result.baseline?.billIds ?? []);
  const after = new Set(result.after?.billIds ?? []);
  const excluded = new Map(result.excluded.map((e) => [e.billId, e.reason]));
  return {
    baselineKwhPerDay: result.baseline?.kwhPerDay ?? null,
    bandPct: result.bandPct,
    points: bills.map((b) => ({
      billId: b.id,
      billingStartDate: b.billingStartDate,
      billingEndDate: b.billingEndDate,
      kwhPerDay: normalizeBill(b).kwhPerDay,
      role: baseline.has(b.id)
        ? 'baseline'
        : after.has(b.id)
          ? 'after'
          : excluded.has(b.id)
            ? 'excluded'
            : 'other',
      excludedReason: excluded.get(b.id) ?? null,
    })),
  };
}

async function measurementView(
  deps: AppDeps,
  plan: PlanRecord,
  business: BusinessRecord,
  m: StoredMeasurement,
) {
  const display = displayFor(m.result, business, await actionPhraseFor(deps, plan.ecoCardOrigin));
  return {
    planId: plan._id,
    ecoId: plan.ecoCardOrigin,
    planTitle: plan.title,
    implementedAt: plan.implementedAt,
    version: m.version,
    inputsHash: m.inputsHash,
    computedAt: m.computedAt,
    ...m.result,
    periods: m.periods,
    display,
    chart: await chartOf(deps, plan.businessId, m.result),
  };
}

/** Plan cuya medición se muestra en «Tu ahorro» y en el reporte: el último terminado. */
async function measuredPlan(deps: AppDeps, businessId: string): Promise<PlanRecord | null> {
  return models(deps)
    .Plan.findOne({ businessId, implementedAt: { $ne: null } })
    .sort({ implementedAt: -1, _id: 1 })
    .lean<PlanRecord>();
}

async function showMeasurement(deps: AppDeps, plan: PlanRecord, business: BusinessRecord) {
  const current = await recomputePlan(deps, plan, business, null);
  if (!current.shownAt)
    await models(deps).Measurement.updateOne(
      { planId: plan._id, version: current.version },
      { $set: { shownAt: nowIso(deps) } },
    );
  return measurementView(deps, plan, business, current);
}

const METHOD_TEXT = (r: MeasurementResult): string | null => {
  if (r.method === 'RECENT_PERIODS') return 'periodos cercanos, sin corrección por temporada';
  if (r.method !== 'YEAR_OVER_YEAR') return null;
  const parts = ['mismos meses del año anterior'];
  if (r.labels.includes('NO_GROWTH_ADJUSTMENT')) parts.push('sin ajuste por crecimiento');
  if (r.labels.includes('ESTIMATED_HISTORY')) parts.push('con datos aproximados del gráfico del recibo');
  return parts.join(', ');
};

const TITLES: Record<MeasurementResult['status'], string> = {
  MEASURED: 'Tu ahorro medido',
  INSUFFICIENT_DATA: 'Todavía no hay un ahorro medido',
  NO_SAVINGS_DETECTED: 'Por ahora no vemos ahorro',
};

export function savingsRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get('/user-eco-card/:id/savings', async (req, res) => {
    const user = requireOwner(req);
    const plan = await models(deps)
      .Plan.findOne({ _id: req.params.id, businessId: user.businessId })
      .lean<PlanRecord>();
    if (!plan) throw notFound('El plan');
    res.json(await showMeasurement(deps, plan, await loadBusiness(deps, user.businessId)));
  });

  /** «Tu ahorro» sin elegir plan: el último terminado, o qué falta si todavía no hay ninguno. */
  router.get('/savings', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    const plan = await measuredPlan(deps, user.businessId);
    if (!plan) {
      res.json({
        planId: null,
        status: 'INSUFFICIENT_DATA',
        reasons: ['NO_IMPLEMENTATION_DATE'],
        display: null,
      });
      return;
    }
    res.json(await showMeasurement(deps, plan, business));
  });

  /** Reporte imprimible de la usuaria: los mismos textos que la app, con fechas y método. */
  router.get('/savings/report', async (req, res) => {
    const user = requireOwner(req);
    const business = await loadBusiness(deps, user.businessId);
    const plan = await measuredPlan(deps, user.businessId);
    const header = {
      business: { name: business.name, city: business.city ?? null, country: business.country },
    };
    if (!plan) {
      res.json({
        ...header,
        status: 'INSUFFICIENT_DATA',
        title: TITLES.INSUFFICIENT_DATA,
        summary: 'Cuando termines tu primer paso, comparamos tus facturas de antes y de después.',
        changeText: null,
        moneyText: null,
        method: null,
        evidence: null,
        period: null,
        computedAt: null,
      });
      return;
    }
    const view = await showMeasurement(deps, plan, business);
    const r = view as unknown as MeasurementResult & typeof view;
    const usedIds = [...(r.baseline?.billIds ?? []), ...(r.after?.billIds ?? [])];
    const used = await models(deps)
      .Bill.find({ _id: { $in: usedIds } })
      .lean<BillRecord[]>();
    const withReceipt = used.length > 0 && used.every((b) => b.evidence === 'photo_ok');
    const measured = r.status === 'MEASURED' && r.changePct !== null && view.display.money;
    res.json({
      ...header,
      planTitle: plan.title,
      implementedAt: plan.implementedAt,
      status: r.status,
      title: TITLES[r.status],
      summary: view.display.summary,
      headline: view.display.headline,
      changeText: measured ? `${formatPercentInt(-r.changePct!)} menos de luz por día` : null,
      moneyText: measured
        ? `${view.display.money!.text} (${view.display.money!.rangeText.charAt(0).toLowerCase()}${view.display.money!.rangeText.slice(1)})`
        : null,
      methodLine: view.display.methodLine,
      tariffNote: view.display.tariffNote,
      nextStep: view.display.nextStep,
      method: METHOD_TEXT(r),
      evidence:
        used.length === 0
          ? null
          : withReceipt
            ? 'con comprobante'
            : 'declarado (alguna factura sin foto clara)',
      period: view.periods,
      computedAt: view.computedAt,
      version: view.version,
      inputsHash: view.inputsHash,
    });
  });

  router.get('/audit/measurements/:planId', async (req, res) => {
    requireStaff(req);
    const items = await models(deps)
      .Measurement.find({ planId: req.params.planId })
      .sort({ version: 1 })
      .lean<StoredMeasurement[]>();
    res.json({
      items: items.map((m) => ({
        version: m.version,
        current: m.current,
        status: m.status,
        reasons: m.result.reasons,
        method: m.result.method,
        changePct: m.result.changePct,
        inputsHash: m.inputsHash,
        methodVersion: m.methodVersion,
        computedAt: m.computedAt,
        shownAt: m.shownAt,
      })),
    });
  });

  return router;
}
