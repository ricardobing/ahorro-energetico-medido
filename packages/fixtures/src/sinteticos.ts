/**
 * Datos SINTÉTICOS: no vienen del caso. Sirven para probar y demostrar lo que el caso no cubre
 * (facturas posteriores a la implementación, otras panaderías, un negocio nuevo, el informe para aliados).
 * Cada registro lleva `fuente: 'sintetico'` y la interfaz los rotula como tales.
 */
import type { Bill, CatalogEco, Country, IsoDate, PlanStatus } from '@ppam/domain';
import type { FixtureBusiness } from './caso.js';

/** Fecha actual de la demostración: después de la factura de junio de Inés. */
export const DEMO_TODAY: IsoDate = '2026-07-10';

/** Día en que Inés termina el primer paso en la simulación. */
export const INES_IMPLEMENTED_AT: IsoDate = '2026-07-08';

/** Facturas que llegan con «Simular el paso del tiempo». Julio contiene el día del cambio. */
export const INES_BILLS_SIMULATED: (Bill & { fuente: 'sintetico' })[] = [
  {
    id: 'bill_ines_2026_07',
    serviceType: 'electricity',
    billingStartDate: '2026-07-01',
    billingEndDate: '2026-07-31',
    kwhConsumed: 1790,
    costPerKwh: 0.84,
    fuente: 'sintetico',
  },
  {
    id: 'bill_ines_2026_08',
    serviceType: 'electricity',
    billingStartDate: '2026-08-01',
    billingEndDate: '2026-08-31',
    kwhConsumed: 1770,
    costPerKwh: 0.84,
    fuente: 'sintetico',
  },
  {
    id: 'bill_ines_2026_09',
    serviceType: 'electricity',
    billingStartDate: '2026-09-01',
    billingEndDate: '2026-09-30',
    kwhConsumed: 1600,
    costPerKwh: 0.84,
    fuente: 'sintetico',
  },
];

/** Historial que mostraría el gráfico del recibo de junio (julio a diciembre de 2025), cargado a mano. */
export const INES_RECEIPT_HISTORY_2025 = {
  fuente: 'sintetico' as const,
  months: [
    { month: '2025-07', kwh: 1690 },
    { month: '2025-08', kwh: 1710 },
    { month: '2025-09', kwh: 1680 },
    { month: '2025-10', kwh: 1760 },
    { month: '2025-11', kwh: 2150 },
    { month: '2025-12', kwh: 2480 },
  ],
};

/** Una factura de mes calendario completo. */
export function monthlyBill(id: string, month: string, kwhConsumed: number, costPerKwh: number): Bill {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    id,
    serviceType: 'electricity',
    billingStartDate: `${month}-01`,
    billingEndDate: `${month}-${String(last).padStart(2, '0')}`,
    kwhConsumed,
    costPerKwh,
  };
}

export const NEW_BUSINESS: FixtureBusiness = {
  id: 'neg_nuevo',
  name: 'Panadería El Trigal',
  ownerName: 'Rosa Quispe',
  email: 'rosa@ejemplo.test',
  country: 'PE',
  city: 'Cusco',
  ciiu: '1071',
  employeesText: 'tres personas',
  description:
    'Panadería de barrio, hacemos pan y tortas todos los días. Tenemos horno eléctrico y una congeladora.',
  equipment: ['electric_oven', 'refrigeration'],
  ovenType: 'electric',
  diagnostic: { topic: 'energy', level: 'Inicial' },
  constraints: { budgetQuarterCents: 80_000, hoursPerWeek: 3 },
  fuente: 'sintetico',
};

export const DEMO_USERS = {
  ines: { id: 'usr_ines', role: 'owner' as const, businessId: 'neg_ines', displayName: 'Inés Huamán' },
  nuevo: { id: 'usr_rosa', role: 'owner' as const, businessId: 'neg_nuevo', displayName: 'Rosa Quispe' },
  aliado: {
    id: 'usr_aliado',
    role: 'partner' as const,
    businessId: null,
    displayName: 'Fondo aliado (sintético)',
  },
  equipo: {
    id: 'usr_equipo',
    role: 'staff' as const,
    businessId: null,
    displayName: 'Equipo Kamai (sintético)',
  },
};

type SyntheticEco = CatalogEco & { fuente: 'sintetico' };

/** Ocho ecoinnovaciones de otras categorías para que el catálogo no sea solo el del caso. */
export const CATALOG_SYNTHETIC: SyntheticEco[] = [
  {
    id: 'eco_301',
    title: 'Ajustar el aire acondicionado a 24 °C',
    category: 'ENERGY',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce el consumo de climatización',
    returnInvestment: 'Inmediato',
    steps: ['Revisar la temperatura configurada', 'Fijarla en 24 °C', 'Cerrar puertas y ventanas al usarlo'],
    ciiuCodes: [],
    targetEquipment: ['air_conditioning'],
    fuente: 'sintetico',
  },
  {
    id: 'eco_302',
    title: 'Reparar fugas de agua',
    category: 'WATER',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce el consumo de agua',
    returnInvestment: 'Inmediato',
    steps: ['Revisar caños y llaves', 'Cambiar empaques', 'Registrar el consumo'],
    ciiuCodes: [],
    fuente: 'sintetico',
  },
  {
    id: 'eco_303',
    title: 'Instalar aireadores en los caños',
    category: 'WATER',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce el caudal sin perder presión',
    returnInvestment: 'Menos de 6 meses',
    steps: ['Contar los caños', 'Comprar aireadores', 'Instalarlos'],
    ciiuCodes: [],
    fuente: 'sintetico',
  },
  {
    id: 'eco_304',
    title: 'Separar residuos para reciclaje',
    category: 'WASTE',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'MEDIA',
    collaborators: 'MEDIA',
    impact: 'Reduce los residuos que van al relleno',
    returnInvestment: 'Ingresos por venta de reciclables',
    steps: ['Poner tachos por tipo', 'Acordar con un reciclador', 'Registrar los kilos'],
    ciiuCodes: [],
    fuente: 'sintetico',
  },
  {
    id: 'eco_305',
    title: 'Donar el pan del día que no se vendió',
    category: 'WASTE',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce el desperdicio de alimentos',
    returnInvestment: 'Inmediato',
    steps: ['Elegir una organización', 'Acordar el horario de retiro', 'Registrar lo donado'],
    ciiuCodes: ['1071'],
    fuente: 'sintetico',
  },
  {
    id: 'eco_306',
    title: 'Comprar insumos a granel',
    category: 'SUPPLY',
    complexity: 'MEDIA',
    investment: 'MEDIA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce envases y costo por unidad',
    returnInvestment: 'Inmediato',
    steps: ['Listar los insumos de mayor rotación', 'Cotizar a granel', 'Ajustar el almacenamiento'],
    ciiuCodes: [],
    fuente: 'sintetico',
  },
  {
    id: 'eco_307',
    title: 'Envases retornables para clientes frecuentes',
    category: 'PACKAGING',
    complexity: 'MEDIA',
    investment: 'BAJA',
    time: 'MEDIA',
    collaborators: 'MEDIA',
    impact: 'Reduce bolsas y envases descartables',
    returnInvestment: 'Entre 3 y 6 meses',
    steps: ['Elegir el envase', 'Definir el depósito', 'Comunicarlo a los clientes'],
    ciiuCodes: [],
    fuente: 'sintetico',
  },
  {
    id: 'eco_308',
    title: 'Registrar los consumos de luz y agua cada mes',
    category: 'MANAGEMENT',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Permite ver si los cambios funcionan',
    returnInvestment: 'Inmediato',
    steps: ['Guardar cada factura', 'Subirla a Kamai', 'Revisar el resultado'],
    ciiuCodes: [],
    fuente: 'sintetico',
  },
];

export interface SyntheticElection {
  ecoId: string;
  status: PlanStatus;
  implementedAt?: IsoDate;
  /** Resultado medido (cambio del consumo por día, %). Solo para las que tienen facturas antes y después. */
  measured?: {
    changePct: number;
    measuredAt: IsoDate;
    evidence: 'with_receipt' | 'declared';
    kwhPerMonth: number;
  };
  /** Formulario de impacto percibido (declarado, no medido). */
  perceived?: { scale: 1 | 2 | 3 | 4 | 5; text: string; submittedAt: IsoDate };
}

export interface SyntheticBakery {
  id: string;
  name: string;
  country: Country;
  ovenType: 'electric' | 'gas' | 'diesel';
  elections: SyntheticElection[];
  fuente: 'sintetico';
}

const PE: Country = 'PE';
const BO: Country = 'BO';

/**
 * 22 panaderías sintéticas que, junto con Inés, reproducen la tabla del caso:
 * 29 elecciones, 20 completadas y 12 medidas (burletes 9/7/4 con −6 %, tandas 6/3/2 con −11 %,
 * LED 11/9/5 con −4 %, aislamiento 2/1/1 con −18 %, calentador 1/0/0). Ninguna medición se superpone con otra.
 */
export const SYNTHETIC_BAKERIES: SyntheticBakery[] = [
  {
    id: 'pan_s01',
    name: 'Panadería sintética 01',
    country: PE,
    ovenType: 'electric',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_033',
        status: 'completed',
        implementedAt: '2026-03-02',
        perceived: { scale: 4, text: 'Se nota más luz y menos calor.', submittedAt: '2026-07-06' },
      },
      { ecoId: 'eco_204', status: 'completed', implementedAt: '2026-05-04' },
    ],
  },
  {
    id: 'pan_s02',
    name: 'Panadería sintética 02',
    country: PE,
    ovenType: 'electric',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_033',
        status: 'completed',
        implementedAt: '2026-04-06',
        measured: { changePct: -2, measuredAt: '2026-07-15', evidence: 'with_receipt', kwhPerMonth: 30 },
      },
      { ecoId: 'eco_204', status: 'in_progress' },
    ],
  },
  {
    id: 'pan_s03',
    name: 'Panadería sintética 03',
    country: PE,
    ovenType: 'electric',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_033',
        status: 'completed',
        implementedAt: '2026-04-13',
        measured: { changePct: -3, measuredAt: '2026-07-20', evidence: 'declared', kwhPerMonth: 42 },
      },
      { ecoId: 'eco_204', status: 'paused' },
    ],
  },
  {
    id: 'pan_s04',
    name: 'Panadería sintética 04',
    country: PE,
    ovenType: 'electric',
    fuente: 'sintetico',
    elections: [
      { ecoId: 'eco_033', status: 'completed', implementedAt: '2026-02-16' },
      { ecoId: 'eco_204', status: 'delayed' },
    ],
  },
  {
    id: 'pan_s05',
    name: 'Panadería sintética 05',
    country: PE,
    ovenType: 'electric',
    fuente: 'sintetico',
    elections: [
      { ecoId: 'eco_033', status: 'completed', implementedAt: '2026-01-19' },
      {
        ecoId: 'eco_071',
        status: 'completed',
        implementedAt: '2026-04-20',
        measured: { changePct: -18, measuredAt: '2026-08-10', evidence: 'with_receipt', kwhPerMonth: 380 },
      },
    ],
  },
  {
    id: 'pan_s06',
    name: 'Panadería sintética 06',
    country: PE,
    ovenType: 'gas',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_033',
        status: 'completed',
        implementedAt: '2026-03-09',
        perceived: { scale: 3, text: 'Creo que bajó un poco.', submittedAt: '2026-07-21' },
      },
      { ecoId: 'eco_090', status: 'in_progress' },
    ],
  },
  {
    id: 'pan_s07',
    name: 'Panadería sintética 07',
    country: PE,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_033',
        status: 'completed',
        implementedAt: '2026-05-11',
        measured: { changePct: -4, measuredAt: '2026-08-12', evidence: 'with_receipt', kwhPerMonth: 55 },
      },
    ],
  },
  {
    id: 'pan_s08',
    name: 'Panadería sintética 08',
    country: PE,
    ovenType: 'gas',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_033',
        status: 'completed',
        implementedAt: '2026-05-18',
        measured: { changePct: -5, measuredAt: '2026-08-20', evidence: 'with_receipt', kwhPerMonth: 61 },
      },
    ],
  },
  {
    id: 'pan_s09',
    name: 'Panadería sintética 09',
    country: PE,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_033',
        status: 'completed',
        implementedAt: '2026-06-01',
        measured: { changePct: -6, measuredAt: '2026-09-05', evidence: 'with_receipt', kwhPerMonth: 70 },
      },
    ],
  },
  {
    id: 'pan_s10',
    name: 'Panadería sintética 10',
    country: PE,
    ovenType: 'gas',
    fuente: 'sintetico',
    elections: [{ ecoId: 'eco_033', status: 'in_progress' }],
  },
  {
    id: 'pan_s11',
    name: 'Panadería sintética 11',
    country: PE,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [{ ecoId: 'eco_033', status: 'to_define' }],
  },
  {
    id: 'pan_s12',
    name: 'Panadería sintética 12',
    country: PE,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_118',
        status: 'completed',
        implementedAt: '2026-04-27',
        measured: { changePct: -4, measuredAt: '2026-07-28', evidence: 'with_receipt', kwhPerMonth: 64 },
        perceived: { scale: 4, text: 'Las refrigeradoras ya no hacen hielo.', submittedAt: '2026-08-04' },
      },
    ],
  },
  {
    id: 'pan_s13',
    name: 'Panadería sintética 13',
    country: PE,
    ovenType: 'gas',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_118',
        status: 'completed',
        implementedAt: '2026-05-04',
        measured: { changePct: -5, measuredAt: '2026-08-03', evidence: 'declared', kwhPerMonth: 72 },
      },
    ],
  },
  {
    id: 'pan_s14',
    name: 'Panadería sintética 14',
    country: PE,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_118',
        status: 'completed',
        implementedAt: '2026-05-25',
        measured: { changePct: -7, measuredAt: '2026-08-25', evidence: 'with_receipt', kwhPerMonth: 101 },
      },
    ],
  },
  {
    id: 'pan_s15',
    name: 'Panadería sintética 15',
    country: BO,
    ovenType: 'gas',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_118',
        status: 'completed',
        implementedAt: '2026-06-08',
        measured: { changePct: -8, measuredAt: '2026-09-09', evidence: 'with_receipt', kwhPerMonth: 88 },
        perceived: { scale: 4, text: 'Ahora descongelamos cada quince días.', submittedAt: '2026-09-12' },
      },
    ],
  },
  {
    id: 'pan_s16',
    name: 'Panadería sintética 16',
    country: BO,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [{ ecoId: 'eco_118', status: 'completed', implementedAt: '2026-03-16' }],
  },
  {
    id: 'pan_s17',
    name: 'Panadería sintética 17',
    country: BO,
    ovenType: 'gas',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_118',
        status: 'completed',
        implementedAt: '2026-02-23',
        perceived: { scale: 5, text: 'Bajó la factura.', submittedAt: '2026-08-18' },
      },
    ],
  },
  {
    id: 'pan_s18',
    name: 'Panadería sintética 18',
    country: BO,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [{ ecoId: 'eco_118', status: 'completed', implementedAt: '2026-06-22' }],
  },
  {
    id: 'pan_s19',
    name: 'Panadería sintética 19',
    country: BO,
    ovenType: 'gas',
    fuente: 'sintetico',
    elections: [{ ecoId: 'eco_118', status: 'in_progress' }],
  },
  {
    id: 'pan_s20',
    name: 'Panadería sintética 20',
    country: BO,
    ovenType: 'diesel',
    fuente: 'sintetico',
    elections: [{ ecoId: 'eco_118', status: 'delayed' }],
  },
  {
    id: 'pan_s21',
    name: 'Panadería sintética 21',
    country: BO,
    ovenType: 'electric',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_204',
        status: 'completed',
        implementedAt: '2026-05-11',
        measured: { changePct: -9, measuredAt: '2026-08-14', evidence: 'with_receipt', kwhPerMonth: 190 },
      },
    ],
  },
  {
    id: 'pan_s22',
    name: 'Panadería sintética 22',
    country: BO,
    ovenType: 'electric',
    fuente: 'sintetico',
    elections: [
      {
        ecoId: 'eco_204',
        status: 'completed',
        implementedAt: '2026-06-15',
        measured: { changePct: -13, measuredAt: '2026-09-18', evidence: 'declared', kwhPerMonth: 240 },
      },
    ],
  },
];

/** Descripciones para el perfil asistido (pruebas y demostración). */
export const PROFILE_DESCRIPTIONS = {
  ines: 'Tengo una panadería en Arequipa, somos 6. El horno es eléctrico y tenemos dos refrigeradoras. Este trimestre puedo poner unos 1200 soles y 4 horas por semana.',
  panaderiaDeBarrio: 'Panadería de barrio, hacemos pan y tortas todos los días',
  sinMontos: 'Somos una cafetería chica en el centro, tenemos una vitrina refrigerada y una máquina de café.',
};
