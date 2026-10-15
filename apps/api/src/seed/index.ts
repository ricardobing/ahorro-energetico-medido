import type { Connection, Model } from 'mongoose';
import {
  billTotalCents,
  co2EquivalentKg,
  COUNTRY_PARAMS,
  type Bill,
  type CatalogEco,
  type Country,
} from '@ppam/domain';
import {
  CATALOG_CASE,
  CATALOG_SYNTHETIC,
  DEMO_TODAY,
  DEMO_USERS,
  INES,
  INES_BILLS,
  INES_BILLS_SIMULATED,
  NEW_BUSINESS,
  PEER_STATS_CASE,
  PLAN_552,
  SYNTHETIC_BAKERIES,
  type FixtureBusiness,
} from '@ppam/fixtures';
import { ensureIndexes, getModels } from '../db/models.js';
import type { SyntheticOutcome } from '../core/measurements.js';

export interface SeedOptions {
  /** Agrega las facturas de julio a septiembre de Inés (la «simulación del paso del tiempo»). */
  simulation?: boolean;
}

/** Versión de las estadísticas de pares cargadas desde la tabla del caso. */
export const CASE_PEER_STATS_VERSION = 'case_table-1';

/** Frase en pasado para «Desde que …» de cada ecoinnovación. */
const ACTION_PHRASES: Record<string, string> = {
  eco_118: 'cambiaste los burletes',
  eco_204: 'empezaste a hornear por tandas',
  eco_033: 'cambiaste a luces LED',
  eco_071: 'aislaste el horno',
  eco_090: 'instalaste el calentador solar',
  eco_301: 'ajustaste el aire acondicionado',
  eco_308: 'empezaste a registrar tus consumos',
};

/** Tarifas sintéticas para valorizar el ahorro de las panaderías sintéticas (no tienen facturas cargadas). */
const SYNTHETIC_TARIFF: Record<Country, number> = { PE: 0.84, BO: 0.95 };

const SEED_CREATED_AT = `${DEMO_TODAY}T09:00:00.000Z`;

function businessDoc(b: FixtureBusiness) {
  return {
    _id: b.id,
    name: b.name,
    ownerName: b.ownerName,
    email: b.email,
    country: b.country,
    city: b.city,
    ciiu: b.ciiu,
    employeesText: b.employeesText,
    description: b.description,
    equipment: b.equipment,
    ovenType: b.ovenType,
    diagnostic: b.diagnostic,
    constraints: b.constraints,
    goalCategory: 'ENERGY',
    aiNoticeAcceptedAt: null,
    dataSource: b.fuente,
    createdAt: SEED_CREATED_AT,
  };
}

function billDoc(b: Bill, businessId: string, country: Country, dataSource: 'caso' | 'sintetico') {
  return {
    _id: b.id,
    businessId,
    serviceType: b.serviceType,
    kwhConsumed: b.kwhConsumed,
    costPerKwh: b.costPerKwh,
    billingStartDate: b.billingStartDate,
    billingEndDate: b.billingEndDate,
    currency: COUNTRY_PARAMS[country].currency,
    totalCostCents: billTotalCents(b.kwhConsumed, b.costPerKwh),
    co2Equivalent: co2EquivalentKg(b.kwhConsumed, country),
    // El caso dice que Inés subió sus facturas: se cargan con comprobante.
    evidence: 'photo_ok',
    uploadedFiles: [],
    source: 'user',
    atypicalConfirmed: false,
    version: 1,
    deletedAt: null,
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_CREATED_AT,
    dataSource,
  };
}

function ecoDoc(e: CatalogEco & { fuente: string; sinteticos?: string[] }) {
  const { id, fuente, sinteticos, ...rest } = e;
  return {
    _id: id,
    ...rest,
    actionPhrase: ACTION_PHRASES[id],
    dataSource: fuente,
    sinteticos: sinteticos ?? [],
  };
}

/** Facturas sintéticas de la simulación, cargadas como si Inés las hubiera subido con foto. */
export function simulatedBillDocs(months: number = INES_BILLS_SIMULATED.length) {
  return INES_BILLS_SIMULATED.slice(0, months).map((b) => billDoc(b, INES.id, 'PE', 'sintetico'));
}

/**
 * Carga los datos del caso (Inés, sus seis facturas, `plan_552`, el catálogo y la tabla de pares) y los
 * sintéticos rotulados (22 panaderías, el negocio nuevo, el catálogo ampliado y los usuarios de demostración).
 * Borra lo que haya antes: la carga es idempotente.
 */
export async function seedDemoData(connection: Connection, options: SeedOptions = {}): Promise<void> {
  const m = getModels(connection);
  await ensureIndexes(connection);
  await Promise.all(Object.values(m).map((model) => (model as Model<unknown>).deleteMany({})));

  const catalog = [...CATALOG_CASE, ...CATALOG_SYNTHETIC];
  const stepsOf = (ecoId: string) => catalog.find((e) => e.id === ecoId)?.steps ?? [];

  await m.User.insertMany(
    Object.entries(DEMO_USERS).map(([demoKey, u]) => ({
      _id: u.id,
      demoKey,
      role: u.role,
      businessId: u.businessId,
      displayName: u.displayName,
      email: demoKey === 'ines' ? INES.email : demoKey === 'nuevo' ? NEW_BUSINESS.email : null,
    })),
  );

  await m.Business.insertMany([
    businessDoc(INES),
    businessDoc(NEW_BUSINESS),
    ...SYNTHETIC_BAKERIES.map((b) => ({
      _id: b.id,
      name: b.name,
      country: b.country,
      ciiu: '1071',
      equipment: ['refrigeration', ...(b.ovenType === 'electric' ? ['electric_oven'] : ['gas_oven'])],
      ovenType: b.ovenType,
      diagnostic: { topic: 'energy', level: 'Crecimiento' },
      constraints: { budgetQuarterCents: null, hoursPerWeek: null },
      goalCategory: 'ENERGY',
      aiNoticeAcceptedAt: null,
      dataSource: 'sintetico',
      createdAt: SEED_CREATED_AT,
    })),
  ]);

  await m.Eco.insertMany(catalog.map(ecoDoc));

  await m.Plan.create({
    _id: PLAN_552.id,
    businessId: PLAN_552.businessId,
    ecoCardOrigin: PLAN_552.ecoCardOrigin,
    title: PLAN_552.title,
    status: PLAN_552.status,
    statusUpdatedAt: PLAN_552.statusUpdatedAt,
    createdAt: PLAN_552.createdAt,
    lastStepChangeAt: PLAN_552.statusUpdatedAt,
    steps: PLAN_552.steps,
    implementedAt: null,
    dataSource: PLAN_552.fuente,
  });

  const bills = [...INES_BILLS.map((b) => billDoc(b, INES.id, 'PE', 'caso'))];
  if (options.simulation) bills.push(...simulatedBillDocs());
  await m.Bill.insertMany(bills);

  await m.PeerStat.insertMany(
    PEER_STATS_CASE.map((p) => ({
      version: CASE_PEER_STATS_VERSION,
      sector: '1071',
      ecoId: p.ecoId,
      chose: p.chose,
      completed: p.completed,
      measuredCount: p.measuredCount,
      medianChangePct: p.medianChangePct,
      source: 'case_table',
      createdAt: SEED_CREATED_AT,
    })),
  );
  await m.Setting.insertMany([
    { _id: 'peerStatsVersion', value: CASE_PEER_STATS_VERSION },
    { _id: 'demoToday', value: DEMO_TODAY },
  ]);

  // Panaderías sintéticas: planes, resultados medidos (sin facturas cargadas) y formularios de impacto percibido.
  const plans = [];
  const measurements = [];
  const perceived = [];
  for (const bakery of SYNTHETIC_BAKERIES) {
    for (const election of bakery.elections) {
      const planId = `plan_${bakery.id}_${election.ecoId}`;
      const eco = catalog.find((e) => e.id === election.ecoId)!;
      const done = election.status === 'completed';
      plans.push({
        _id: planId,
        businessId: bakery.id,
        ecoCardOrigin: election.ecoId,
        title: eco.title,
        status: election.status,
        statusUpdatedAt: election.implementedAt ?? '2026-05-01',
        createdAt: '2026-01-05',
        lastStepChangeAt: election.implementedAt ?? '2026-05-01',
        steps: stepsOf(election.ecoId).map((title, i) => ({
          _id: `step_${i + 1}`,
          title,
          status: done ? 'completed' : 'not_started',
          subSteps: [],
        })),
        implementedAt: election.implementedAt ?? null,
        dataSource: 'sintetico',
      });
      if (done) {
        const measured = election.measured;
        const kwhPerMonth = measured?.kwhPerMonth ?? null;
        const synthetic: SyntheticOutcome = {
          // Sin factura posterior todavía si terminó hace poco; sin datos si nunca subió facturas.
          category: measured
            ? 'measured'
            : (election.implementedAt ?? '') >= '2026-05-01'
              ? 'notYet'
              : 'noData',
          ecoId: election.ecoId,
          changePct: measured?.changePct ?? null,
          evidence: measured?.evidence ?? null,
          method: measured ? 'RECENT_PERIODS' : null,
          kwhPerMonth,
          amountPerMonthCents:
            kwhPerMonth === null ? null : Math.round(kwhPerMonth * SYNTHETIC_TARIFF[bakery.country] * 100),
          currency: COUNTRY_PARAMS[bakery.country].currency as 'PEN' | 'BOB',
          measuredAt: measured?.measuredAt ?? null,
        };
        measurements.push({
          planId,
          businessId: bakery.id,
          version: 1,
          current: true,
          inputsHash: 'sintetico',
          methodVersion: '1.0.0',
          status: measured ? 'MEASURED' : 'INSUFFICIENT_DATA',
          result: {
            status: measured ? 'MEASURED' : 'INSUFFICIENT_DATA',
            reasons: measured ? [] : ['NO_AFTER_BILL'],
            changePct: measured?.changePct ?? null,
            method: synthetic.method,
          },
          periods: null,
          computedAt: `${measured?.measuredAt ?? election.implementedAt}T12:00:00.000Z`,
          shownAt: null,
          synthetic,
        });
      }
      if (election.perceived)
        perceived.push({
          businessId: bakery.id,
          planId,
          ecoId: election.ecoId,
          scale: election.perceived.scale,
          text: election.perceived.text,
          submittedAt: election.perceived.submittedAt,
        });
    }
  }
  await m.Plan.insertMany(plans);
  await m.Measurement.insertMany(measurements);
  await m.Perceived.insertMany(perceived);
}
