import type { MeasurementResult, SavingsDisplay } from '@ppam/domain';

/** Formas de las respuestas de la API que usa la web (el contrato está en design.md). */

export interface Me {
  user: { id: string; role: 'owner' | 'partner' | 'staff'; displayName: string };
  business: { name: string; country: 'PE' | 'BO'; city: string | null } | null;
  today: string;
  demoMode: boolean;
}

export type Level = 'BAJA' | 'MEDIA' | 'ALTA';

export interface EcoSummary {
  ecoId: string;
  title: string;
  category: string;
  complexity: Level;
  investment: Level;
  time: Level;
  impact: string;
  returnInvestment: string;
  steps: string[];
  dataSource: string | null;
}

export interface FirstStep {
  recommendation: {
    id: string;
    ecoId: string;
    createdAt: string;
    rulesetVersion: string;
    eco: EcoSummary | null;
  } | null;
  explanation: { reasons: string[]; unknown: string };
  alternatives: {
    ecoId: string;
    title: string;
    investment: Level;
    time: Level;
    complexity: Level;
    budgetFit: 'FULL' | 'PARTIAL';
    mayExceedBudget: boolean;
  }[];
  why: {
    peerCounts: { chose: number; completed: number; measured: number };
    factors: {
      pComplete: number;
      effectPct: number;
      detectable: boolean;
      budgetFit: string;
      timeFit: string;
    };
    dataUsed: {
      budgetCents: number | null;
      hoursPerWeek: number | null;
      diagnosticLevel: string;
      equipment: string[] | null;
      ovenType: string;
      billsCount: number;
      peerStatsVersion: string;
    };
    rulesetVersion: string;
  } | null;
  stalledPlan: { id: string; title: string; daysWithoutChange: number } | null;
  decision: { type: 'accepted' | 'chose_alternative'; ecoId: string; planId: string; at: string } | null;
}

export interface PlanStep {
  _id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  subSteps: string[];
}

export interface Plan {
  id: string;
  ecoCardOrigin: string;
  title: string;
  status: 'not_started' | 'to_define' | 'in_progress' | 'delayed' | 'completed' | 'paused';
  statusUpdatedAt: string;
  createdAt: string;
  steps: PlanStep[];
  implementedAt: string | null;
  stalled: boolean;
  daysWithoutChange: number;
  events: { type: string; at: string }[];
  measurementHint: {
    excludedMonth: string | null;
    firstMeasurableBillEta: string | null;
    message: string;
  } | null;
  dataSource: string | null;
}

export interface Bill {
  id: string;
  serviceType: 'electricity' | 'water';
  kwhConsumed?: number;
  costPerKwh?: number;
  volumeM3?: number;
  costPerM3?: number;
  billingStartDate: string;
  billingEndDate: string;
  days: number;
  totalCost: number;
  totalCostText: string;
  currency: string;
  evidence: 'photo_ok' | 'photo_retake' | 'no_photo';
  source: string;
  version: number;
  dataSource: string | null;
}

export interface ChartPoint {
  billId: string;
  billingStartDate: string;
  billingEndDate: string;
  kwhPerDay: number;
  role: 'baseline' | 'after' | 'excluded' | 'other';
  excludedReason: string | null;
}

export type Savings =
  | { planId: null; status: 'INSUFFICIENT_DATA'; reasons: string[]; display: null }
  | (MeasurementResult & {
      planId: string;
      ecoId: string;
      planTitle: string;
      implementedAt: string | null;
      version: number;
      inputsHash: string;
      computedAt: string;
      display: SavingsDisplay;
      chart: { baselineKwhPerDay: number | null; bandPct: number | null; points: ChartPoint[] };
    });

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface Profile {
  name: string;
  ownerName: string | null;
  country: 'PE' | 'BO';
  city: string | null;
  currency: string;
  ciiu: { code: string; label: string } | null;
  employeesText: string | null;
  description: string | null;
  equipment: string[] | null;
  ovenType: string;
  budgetQuarterCents: number | null;
  hoursPerWeek: number | null;
  diagnosticLevel: string | null;
  dataSource: string;
}

export interface Suggestions {
  ciiu: { code: string; label: string } | null;
  equipment: string[];
  ovenType: string | null;
  budget: { amount: number; currency: string } | null;
  hoursPerWeek: number | null;
  source: 'ai' | 'keywords';
}

export interface SavingsReport {
  business: { name: string; city: string | null; country: string };
  planTitle?: string;
  implementedAt?: string | null;
  status: MeasurementResult['status'];
  title: string;
  summary: string;
  headline?: string;
  changeText: string | null;
  moneyText: string | null;
  methodLine?: string | null;
  tariffNote?: string | null;
  nextStep?: string | null;
  method: string | null;
  evidence: string | null;
  period: {
    baselineFrom: string | null;
    baselineTo: string | null;
    afterFrom: string | null;
    afterTo: string | null;
  } | null;
  computedAt: string | null;
  version?: number;
  inputsHash?: string;
}

export type Hidden = number | string;

export interface PartnerReport {
  period: string;
  from: string;
  to: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  sectors: { ciiu: string; label: string }[];
  countries: string[];
  byStatus: { measured: Hidden; notYet: Hidden; noSavings: Hidden; noData: Hidden };
  byEco: { ecoId: string; title: string; businesses: Hidden; medianChangePct: number | null }[];
  combos: Hidden;
  measured: {
    businesses: Hidden;
    kwhPerMonth: number | null;
    co2KgPerMonth: number | null;
    evidence: { withReceipt: number | null; declared: number | null; hiddenNote: string | null };
    method: Record<string, Hidden>;
  };
  declared: { label: string; forms: Hidden; medianScale: number | null; scaleNote: string };
  amounts: {
    currency: string;
    businesses: Hidden;
    amountPerMonthCents: number | null;
    amountText: string | null;
  }[];
  usd: number | null;
  usdNote: string;
  adjustments: {
    period: string;
    note: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }[];
  notes: string[];
}
