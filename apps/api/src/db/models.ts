import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';

/**
 * Modelos de Mongoose sobre una conexión dada (cada test usa la suya). Los campos del anexo conservan
 * su nombre; lo nuevo es opcional o vive en colecciones nuevas (ver «Modelo de datos» en design.md).
 * `bufferCommands: false`: si MongoDB no está, la operación falla enseguida y la API responde 503.
 */
const options = { versionKey: false, bufferCommands: false } as const;

const businessSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    ownerName: String,
    email: String,
    country: { type: String, enum: ['PE', 'BO'], required: true },
    city: String,
    ciiu: { type: String, default: null },
    employeesText: String,
    description: String,
    equipment: { type: [String], default: null },
    ovenType: { type: String, default: 'unknown' },
    diagnostic: { topic: String, level: String },
    constraints: {
      budgetQuarterCents: { type: Number, default: null },
      hoursPerWeek: { type: Number, default: null },
    },
    goalCategory: { type: String, default: 'ENERGY' },
    aiNoticeAcceptedAt: { type: String, default: null },
    dataSource: { type: String, enum: ['caso', 'sintetico'], required: true },
    createdAt: String,
  },
  options,
);

const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    demoKey: { type: String, required: true, unique: true },
    role: { type: String, enum: ['owner', 'partner', 'staff'], required: true },
    businessId: { type: String, default: null },
    displayName: String,
    email: { type: String, default: null },
  },
  options,
);

const ecoSchema = new Schema(
  {
    _id: { type: String, required: true },
    title: String,
    category: String,
    complexity: String,
    investment: String,
    time: String,
    collaborators: String,
    impact: String,
    returnInvestment: String,
    steps: [String],
    ciiuCodes: [String],
    targetEquipment: { type: [String], default: undefined },
    /** Frase en pasado para «Desde que …» en la medición. */
    actionPhrase: String,
    dataSource: String,
    sinteticos: [String],
  },
  options,
);

const stepSchema = new Schema(
  {
    _id: { type: String, required: true },
    title: String,
    status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
    subSteps: { type: [String], default: [] },
  },
  { _id: false, versionKey: false },
);

const planSchema = new Schema(
  {
    _id: { type: String, required: true },
    businessId: { type: String, required: true },
    ecoCardOrigin: { type: String, required: true },
    title: String,
    status: {
      type: String,
      enum: ['not_started', 'to_define', 'in_progress', 'delayed', 'completed', 'paused'],
      required: true,
    },
    statusUpdatedAt: String,
    createdAt: String,
    lastStepChangeAt: String,
    steps: [stepSchema],
    implementedAt: { type: String, default: null },
    dataSource: String,
  },
  options,
);
planSchema.index({ businessId: 1, status: 1 });

const planEventSchema = new Schema(
  {
    planId: { type: String, required: true },
    businessId: { type: String, required: true },
    type: { type: String, required: true },
    from: String,
    to: String,
    at: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: undefined },
  },
  options,
);
planEventSchema.index({ planId: 1, at: 1 });

const billFields = {
  businessId: { type: String, required: true },
  serviceType: { type: String, enum: ['electricity', 'water'], required: true },
  kwhConsumed: Number,
  costPerKwh: Number,
  volumeM3: Number,
  costPerM3: Number,
  billingStartDate: { type: String, required: true },
  billingEndDate: { type: String, required: true },
  currency: String,
  totalCostCents: Number,
  co2Equivalent: Number,
  evidence: { type: String, enum: ['photo_ok', 'photo_retake', 'no_photo'] },
  uploadedFiles: { type: [String], default: [] },
  source: String,
  atypicalConfirmed: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  deletedAt: { type: String, default: null },
  createdAt: String,
  updatedAt: String,
  dataSource: { type: String, default: null },
};

const billSchema = new Schema({ _id: { type: String, required: true }, ...billFields }, options);
billSchema.index({ businessId: 1, serviceType: 1, billingStartDate: 1 });

const billVersionSchema = new Schema(
  { billId: { type: String, required: true }, ...billFields, changedAt: String },
  options,
);
billVersionSchema.index({ billId: 1, version: 1 }, { unique: true });

/** Un documento por negocio y servicio: las transacciones de alta lo tocan para que dos altas simultáneas choquen. */
const billLockSchema = new Schema(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  options,
);

const historySchema = new Schema(
  {
    businessId: { type: String, required: true },
    serviceType: { type: String, required: true },
    month: { type: String, required: true },
    kwh: { type: Number, required: true },
    source: { type: String, default: 'bill_chart' },
    estimated: { type: Boolean, default: true },
  },
  options,
);
historySchema.index({ businessId: 1, serviceType: 1, month: 1 }, { unique: true });

const uploadSchema = new Schema(
  {
    _id: { type: String, required: true },
    businessId: { type: String, required: true },
    contentType: String,
    size: Number,
    createdAt: String,
  },
  options,
);

const recommendationSchema = new Schema(
  {
    _id: { type: String, required: true },
    businessId: { type: String, required: true },
    status: { type: String, enum: ['current', 'superseded'], required: true },
    ecoId: { type: String, default: null },
    ranked: { type: Schema.Types.Mixed, default: [] },
    excluded: { type: Schema.Types.Mixed, default: [] },
    inputs: { type: Schema.Types.Mixed, required: true },
    rulesetVersion: String,
    inputsHash: String,
    signature: String,
    decision: { type: Schema.Types.Mixed, default: null },
    /** Última huella de entradas revisada: si no cambió, no se vuelve a calcular. */
    lastInputsHash: String,
    createdAt: String,
    shownAt: { type: String, default: null },
  },
  options,
);
recommendationSchema.index({ businessId: 1, status: 1 });
// Una sola recomendación vigente por negocio, aunque lleguen dos consultas a la vez.
recommendationSchema.index(
  { businessId: 1 },
  { unique: true, partialFilterExpression: { status: 'current' } },
);

const peerStatSchema = new Schema(
  {
    version: { type: String, required: true },
    sector: { type: String, required: true },
    ecoId: { type: String, required: true },
    chose: Number,
    completed: Number,
    measuredCount: Number,
    medianChangePct: { type: Number, default: null },
    source: { type: String, enum: ['case_table', 'computed'] },
    createdAt: String,
  },
  options,
);
peerStatSchema.index({ version: 1, sector: 1, ecoId: 1 }, { unique: true });

const measurementSchema = new Schema(
  {
    planId: { type: String, required: true },
    businessId: { type: String, required: true },
    version: { type: Number, required: true },
    current: { type: Boolean, required: true },
    inputsHash: String,
    methodVersion: String,
    status: String,
    result: { type: Schema.Types.Mixed, required: true },
    /** Fechas de los periodos usados, para el reporte y el informe. */
    periods: { type: Schema.Types.Mixed, default: null },
    computedAt: String,
    shownAt: { type: String, default: null },
    /** Resultado sintético de la carga inicial (panaderías sin facturas cargadas). */
    synthetic: { type: Schema.Types.Mixed, default: null },
  },
  options,
);
measurementSchema.index({ planId: 1, current: 1 });
measurementSchema.index({ planId: 1, version: 1 }, { unique: true });

const notificationSchema = new Schema(
  {
    businessId: { type: String, required: true },
    type: { type: String, required: true },
    title: String,
    body: String,
    link: String,
    dedupeKey: { type: String, default: undefined },
    createdAt: String,
    readAt: { type: String, default: null },
  },
  options,
);
notificationSchema.index({ businessId: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);

const outboxSchema = new Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    businessId: String,
    userId: String,
    to: String,
    template: String,
    ref: String,
    subject: String,
    html: String,
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed', 'bounced', 'suppressed', 'cancelled'],
      required: true,
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: Date,
    lastError: { type: String, default: null },
    sentAt: { type: String, default: null },
    createdAt: String,
  },
  options,
);
outboxSchema.index({ status: 1, nextAttemptAt: 1 });

const suppressionSchema = new Schema(
  { _id: { type: String, required: true }, reason: String, at: String },
  options,
);

const partnerReportSchema = new Schema(
  {
    _id: { type: String, required: true },
    status: { type: String, enum: ['open', 'closed'], required: true },
    closedAt: String,
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  options,
);

const funnelEventSchema = new Schema(
  {
    type: { type: String, required: true },
    businessId: { type: String, required: true },
    ecoId: String,
    planId: String,
    data: { type: Schema.Types.Mixed, default: undefined },
    at: { type: String, required: true },
  },
  options,
);
funnelEventSchema.index({ type: 1, at: 1 });

const perceivedSchema = new Schema(
  {
    businessId: { type: String, required: true },
    planId: String,
    ecoId: String,
    scale: Number,
    text: String,
    submittedAt: String,
  },
  options,
);

const aiUsageSchema = new Schema(
  { _id: { type: String, required: true }, count: { type: Number, default: 0 } },
  options,
);

const settingSchema = new Schema(
  { _id: { type: String, required: true }, value: Schema.Types.Mixed },
  options,
);

const schemas = {
  Business: [businessSchema, 'businesses'],
  User: [userSchema, 'users'],
  Eco: [ecoSchema, 'ecoCatalog'],
  Plan: [planSchema, 'userEcoCards'],
  PlanEvent: [planEventSchema, 'planEvents'],
  Bill: [billSchema, 'userBills'],
  BillVersion: [billVersionSchema, 'userBillVersions'],
  BillLock: [billLockSchema, 'billLocks'],
  History: [historySchema, 'consumptionHistory'],
  Upload: [uploadSchema, 'uploads'],
  Recommendation: [recommendationSchema, 'recommendations'],
  PeerStat: [peerStatSchema, 'peerStats'],
  Measurement: [measurementSchema, 'savingsMeasurements'],
  Notification: [notificationSchema, 'notifications'],
  Outbox: [outboxSchema, 'emailOutbox'],
  Suppression: [suppressionSchema, 'emailSuppressions'],
  PartnerReport: [partnerReportSchema, 'partnerReports'],
  FunnelEvent: [funnelEventSchema, 'funnelEvents'],
  Perceived: [perceivedSchema, 'perceivedImpact'],
  AiUsage: [aiUsageSchema, 'aiUsage'],
  Setting: [settingSchema, 'settings'],
} as const;

type Schemas = typeof schemas;
export type Models = { [K in keyof Schemas]: Model<InferSchemaType<Schemas[K][0]>> };

export type BusinessDoc = InferSchemaType<typeof businessSchema>;
export type PlanDoc = InferSchemaType<typeof planSchema>;
export type BillDoc = InferSchemaType<typeof billSchema>;
export type EcoDoc = InferSchemaType<typeof ecoSchema>;
export type RecommendationDoc = InferSchemaType<typeof recommendationSchema>;
export type MeasurementDoc = InferSchemaType<typeof measurementSchema>;

const cache = new WeakMap<Connection, Models>();

export function getModels(connection: Connection): Models {
  const cached = cache.get(connection);
  if (cached) return cached;
  const models = Object.fromEntries(
    Object.entries(schemas).map(([name, [schema, collection]]) => [
      name,
      connection.models[name] ?? connection.model(name, schema as Schema, collection),
    ]),
  ) as unknown as Models;
  cache.set(connection, models);
  return models;
}

/** Crea las colecciones y sus índices (las transacciones no pueden crear colecciones nuevas en todas las versiones). */
export async function ensureIndexes(connection: Connection): Promise<void> {
  const models = getModels(connection);
  for (const model of Object.values(models)) {
    await model.createCollection().catch(() => undefined);
    await model.syncIndexes();
  }
}
