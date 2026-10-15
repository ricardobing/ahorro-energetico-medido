/**
 * Datos del caso del reto (PDF «Pruebas técnicas», páginas 1 a 7). Todo lo que acá no viene del PDF
 * está marcado en `sinteticos` (campo por campo) o vive en `sinteticos.ts`.
 */
import type {
  Bill,
  CatalogEco,
  DiagnosticLevel,
  Equipment,
  IsoDate,
  OvenType,
  PeerStat,
  PlanStatus,
} from '@ppam/domain';

export interface FixtureBusiness {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  country: 'PE' | 'BO';
  city: string;
  ciiu: string | null;
  employeesText: string;
  description: string;
  equipment: Equipment[] | null;
  ovenType: OvenType;
  diagnostic: { topic: 'energy'; level: DiagnosticLevel };
  constraints: { budgetQuarterCents: number | null; hoursPerWeek: number | null };
  fuente: 'caso' | 'sintetico';
  /** Campos que no vienen del caso aunque el registro sí. */
  sinteticos?: string[];
}

export const INES: FixtureBusiness = {
  id: 'neg_ines',
  name: 'Panadería Santa Inés',
  ownerName: 'Inés Huamán',
  email: 'ines@ejemplo.test',
  country: 'PE',
  city: 'Arequipa',
  ciiu: '1071',
  employeesText: '6',
  description:
    'Tengo una panadería en Arequipa, somos 6. El horno es eléctrico y tenemos dos refrigeradoras. Este trimestre puedo poner unos 1200 soles y 4 horas por semana.',
  equipment: ['electric_oven', 'refrigeration'],
  ovenType: 'electric',
  diagnostic: { topic: 'energy', level: 'Crecimiento' },
  constraints: { budgetQuarterCents: 120_000, hoursPerWeek: 4 },
  fuente: 'caso',
  sinteticos: ['id', 'description (redactada con los datos del caso)', 'ciiu (el caso dice «panadería»)'],
};

/** Las seis facturas de luz de Inés (p. 2 del PDF). Los totales del PDF son kWh × tarifa redondeados al sol. */
export const INES_BILLS: (Bill & { fuente: 'caso'; totalPdf: number })[] = [
  {
    id: 'bill_ines_2026_01',
    serviceType: 'electricity',
    billingStartDate: '2026-01-01',
    billingEndDate: '2026-01-31',
    kwhConsumed: 1840,
    costPerKwh: 0.78,
    totalPdf: 1435,
    fuente: 'caso',
  },
  {
    id: 'bill_ines_2026_02',
    serviceType: 'electricity',
    billingStartDate: '2026-02-01',
    billingEndDate: '2026-02-28',
    kwhConsumed: 1690,
    costPerKwh: 0.78,
    totalPdf: 1318,
    fuente: 'caso',
  },
  {
    id: 'bill_ines_2026_03',
    serviceType: 'electricity',
    billingStartDate: '2026-03-01',
    billingEndDate: '2026-03-31',
    kwhConsumed: 1910,
    costPerKwh: 0.81,
    totalPdf: 1547,
    fuente: 'caso',
  },
  {
    id: 'bill_ines_2026_04',
    serviceType: 'electricity',
    billingStartDate: '2026-04-01',
    billingEndDate: '2026-04-30',
    kwhConsumed: 1760,
    costPerKwh: 0.81,
    totalPdf: 1426,
    fuente: 'caso',
  },
  {
    id: 'bill_ines_2026_05',
    serviceType: 'electricity',
    billingStartDate: '2026-05-01',
    billingEndDate: '2026-05-31',
    kwhConsumed: 1880,
    costPerKwh: 0.81,
    totalPdf: 1523,
    fuente: 'caso',
  },
  {
    id: 'bill_ines_2026_06',
    serviceType: 'electricity',
    billingStartDate: '2026-06-01',
    billingEndDate: '2026-06-30',
    kwhConsumed: 1720,
    costPerKwh: 0.84,
    totalPdf: 1445,
    fuente: 'caso',
  },
];

export interface FixturePlan {
  id: string;
  businessId: string;
  ecoCardOrigin: string;
  title: string;
  status: PlanStatus;
  statusUpdatedAt: IsoDate;
  createdAt: IsoDate;
  steps: {
    _id: string;
    title: string;
    status: 'not_started' | 'in_progress' | 'completed';
    subSteps: string[];
  }[];
  implementedAt?: IsoDate;
  fuente: 'caso' | 'sintetico';
}

/** El plan del anexo (p. 6): aislamiento térmico del horno, en progreso y con su único paso sin empezar. */
export const PLAN_552: FixturePlan = {
  id: 'plan_552',
  businessId: 'neg_ines',
  ecoCardOrigin: 'eco_071',
  title: 'Aislamiento térmico del horno',
  status: 'in_progress',
  statusUpdatedAt: '2026-04-12',
  createdAt: '2026-04-12',
  steps: [{ _id: 'step_1', title: 'Cotizar aislamiento', status: 'not_started', subSteps: [] }],
  fuente: 'caso',
};

type FixtureEco = CatalogEco & { fuente: 'caso'; sinteticos: string[] };

/**
 * Las cinco ecoinnovaciones del caso. `eco_118` es la del anexo, completa. De las demás, el caso da título,
 * inversión y complejidad; el resto de los campos es sintético y está listado en `sinteticos`.
 */
export const CATALOG_CASE: FixtureEco[] = [
  {
    id: 'eco_118',
    title: 'Mantenimiento de burletes y descongelamiento de refrigeradoras',
    category: 'ENERGY',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce el consumo de refrigeración',
    returnInvestment: 'Inmediato',
    steps: ['Revisar burletes', 'Programar descongelamiento', 'Registrar consumo'],
    ciiuCodes: [],
    targetEquipment: ['refrigeration'],
    fuente: 'caso',
    sinteticos: ['targetEquipment'],
  },
  {
    id: 'eco_204',
    title: 'Hornear por tandas y apagar el horno entre ellas',
    category: 'ENERGY',
    complexity: 'MEDIA',
    investment: 'BAJA',
    time: 'MEDIA',
    collaborators: 'MEDIA',
    impact: 'Reduce las horas de horno encendido en vacío',
    returnInvestment: 'Inmediato',
    steps: [
      'Anotar los horarios de horneado de una semana',
      'Agrupar los productos por temperatura',
      'Acordar los horarios con el equipo',
    ],
    ciiuCodes: ['1071'],
    targetEquipment: ['electric_oven'],
    fuente: 'caso',
    sinteticos: [
      'id',
      'time',
      'collaborators',
      'impact',
      'returnInvestment',
      'steps',
      'ciiuCodes',
      'targetEquipment',
    ],
  },
  {
    id: 'eco_033',
    title: 'Iluminación LED',
    category: 'ENERGY',
    complexity: 'BAJA',
    investment: 'MEDIA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce el consumo de iluminación',
    returnInvestment: 'Entre 6 y 12 meses',
    steps: ['Contar los puntos de luz', 'Cotizar lámparas LED', 'Reemplazar las lámparas'],
    ciiuCodes: [],
    targetEquipment: ['lighting'],
    fuente: 'caso',
    sinteticos: ['id', 'time', 'collaborators', 'impact', 'returnInvestment', 'steps', 'targetEquipment'],
  },
  {
    id: 'eco_071',
    title: 'Aislamiento térmico del horno',
    category: 'ENERGY',
    complexity: 'ALTA',
    investment: 'ALTA',
    time: 'ALTA',
    collaborators: 'MEDIA',
    impact: 'Reduce la pérdida de calor del horno',
    returnInvestment: 'Más de 12 meses',
    steps: ['Cotizar aislamiento', 'Coordinar la instalación', 'Verificar la temperatura'],
    ciiuCodes: [],
    targetEquipment: ['electric_oven'],
    fuente: 'caso',
    sinteticos: [
      'time',
      'collaborators',
      'impact',
      'returnInvestment',
      'steps (salvo «Cotizar aislamiento»)',
      'targetEquipment',
    ],
  },
  {
    id: 'eco_090',
    title: 'Calentador solar de agua',
    category: 'ENERGY',
    complexity: 'ALTA',
    investment: 'ALTA',
    time: 'MEDIA',
    collaborators: 'BAJA',
    impact: 'Reemplaza el calentamiento eléctrico de agua',
    returnInvestment: 'Más de 24 meses',
    steps: ['Medir el consumo de agua caliente', 'Cotizar el equipo', 'Instalar'],
    ciiuCodes: [],
    targetEquipment: ['electric_water_heater'],
    fuente: 'caso',
    sinteticos: ['id', 'time', 'collaborators', 'impact', 'returnInvestment', 'steps', 'targetEquipment'],
  },
];

/** Tabla «Datos de negocios similares» (pp. 2-3 del PDF): 23 panaderías de Perú y Bolivia. */
export const PEER_STATS_CASE: (PeerStat & { fuente: 'caso' })[] = [
  { ecoId: 'eco_118', chose: 9, completed: 7, measuredCount: 4, medianChangePct: -6, fuente: 'caso' },
  { ecoId: 'eco_204', chose: 6, completed: 3, measuredCount: 2, medianChangePct: -11, fuente: 'caso' },
  { ecoId: 'eco_033', chose: 11, completed: 9, measuredCount: 5, medianChangePct: -4, fuente: 'caso' },
  { ecoId: 'eco_071', chose: 2, completed: 1, measuredCount: 1, medianChangePct: -18, fuente: 'caso' },
  { ecoId: 'eco_090', chose: 1, completed: 0, measuredCount: 0, medianChangePct: null, fuente: 'caso' },
];

/** Totales de la tabla, para verificar la carga sintética. */
export const PEER_TOTALS_CASE = { bakeries: 23, chose: 29, completed: 20, measured: 12 } as const;
