import { createHash, randomUUID } from 'node:crypto';
import {
  canonicalJson,
  type Bill,
  type BusinessForRecommendation,
  type CatalogEco,
  type Country,
  type DiagnosticLevel,
  type Equipment,
  type OvenType,
} from '@ppam/domain';
import type { AppDeps } from '../app.js';
import { getModels, type Models } from '../db/models.js';

export const models = (deps: AppDeps): Models => getModels(deps.connection);
export const nowIso = (deps: AppDeps): string => deps.clock.now().toISOString();
export const today = (deps: AppDeps): string => deps.clock.today();

/** Identificador legible con prefijo («plan_3f9a1c2e»). */
export const newId = (prefix: string): string => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

/** Huella SHA-256 del JSON canónico. */
export const sha256 = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');

export interface BusinessRecord {
  _id: string;
  name: string;
  ownerName?: string | null;
  email?: string | null;
  country: Country;
  city?: string | null;
  ciiu: string | null;
  employeesText?: string | null;
  description?: string | null;
  equipment: Equipment[] | null;
  ovenType: OvenType;
  diagnostic?: { topic?: string | null; level?: string | null } | null;
  constraints?: { budgetQuarterCents?: number | null; hoursPerWeek?: number | null } | null;
  goalCategory: string;
  aiNoticeAcceptedAt: string | null;
  dataSource: 'caso' | 'sintetico';
}

export async function loadBusiness(deps: AppDeps, businessId: string): Promise<BusinessRecord> {
  const business = await models(deps).Business.findById(businessId).lean<BusinessRecord>();
  if (!business) throw new Error(`Negocio inexistente: ${businessId}`);
  return business;
}

export function businessForRecommendation(b: BusinessRecord): BusinessForRecommendation {
  return {
    country: b.country,
    ciiu: b.ciiu ?? null,
    equipment: b.equipment ?? null,
    ovenType: b.ovenType ?? 'unknown',
    diagnosticLevel: (b.diagnostic?.level ?? 'Inicial') as DiagnosticLevel,
    budgetCents: b.constraints?.budgetQuarterCents ?? null,
    hoursPerWeek: b.constraints?.hoursPerWeek ?? null,
    goalCategory: b.goalCategory ?? 'ENERGY',
  };
}

export interface EcoRecord extends CatalogEco {
  _id: string;
  actionPhrase?: string;
  dataSource?: string;
}

export async function loadCatalog(deps: AppDeps): Promise<EcoRecord[]> {
  const items = await models(deps).Eco.find().sort({ _id: 1 }).lean<Omit<EcoRecord, 'id'>[]>();
  return items.map(
    (e) => ({ ...e, id: e._id, ciiuCodes: e.ciiuCodes ?? [], steps: e.steps ?? [] }) as EcoRecord,
  );
}

export interface BillRecord {
  _id: string;
  businessId: string;
  serviceType: 'electricity' | 'water';
  kwhConsumed?: number | null;
  costPerKwh?: number | null;
  volumeM3?: number | null;
  costPerM3?: number | null;
  billingStartDate: string;
  billingEndDate: string;
  currency: string;
  totalCostCents: number;
  co2Equivalent: number;
  evidence: 'photo_ok' | 'photo_retake' | 'no_photo';
  uploadedFiles: string[];
  source: string;
  atypicalConfirmed: boolean;
  version: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  dataSource?: string | null;
}

/** Facturas vigentes (sin borradas) de luz del negocio, en el formato del dominio. */
export async function loadElectricityBills(deps: AppDeps, businessId: string): Promise<Bill[]> {
  const bills = await models(deps)
    .Bill.find({ businessId, serviceType: 'electricity', deletedAt: null })
    .sort({ billingStartDate: 1 })
    .lean<BillRecord[]>();
  return bills.map(toDomainBill);
}

export function toDomainBill(b: BillRecord): Bill {
  return {
    id: b._id,
    serviceType: 'electricity',
    kwhConsumed: b.kwhConsumed ?? 0,
    costPerKwh: b.costPerKwh ?? 0,
    billingStartDate: b.billingStartDate,
    billingEndDate: b.billingEndDate,
  };
}

export interface PlanRecord {
  _id: string;
  businessId: string;
  ecoCardOrigin: string;
  title: string;
  status: 'not_started' | 'to_define' | 'in_progress' | 'delayed' | 'completed' | 'paused';
  statusUpdatedAt: string;
  createdAt: string;
  lastStepChangeAt: string;
  steps: {
    _id: string;
    title: string;
    status: 'not_started' | 'in_progress' | 'completed';
    subSteps: string[];
  }[];
  implementedAt: string | null;
  dataSource?: string;
}
