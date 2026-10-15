import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { inject } from 'vitest';
import { addDays, compareDates, type IsoDate } from '@ppam/domain';
import type { DEMO_USERS } from '@ppam/fixtures';
import { INES_BILLS_SIMULATED, INES_IMPLEMENTED_AT } from '@ppam/fixtures';
import { createApp, type AppDeps } from '../../src/app.js';
import { DEFAULT_CONFIG, type AppConfig } from '../../src/config.js';
import { seedDemoData } from '../../src/seed/index.js';
import {
  FakeClock,
  FakeCurrency,
  FakeMessaging,
  FakeProfileModel,
  FakeSubtasks,
  MemoryStorage,
  TINY_PNG,
  createMemoryLogger,
} from './fakes.js';

export type DemoUser = keyof typeof DEMO_USERS;

export interface TestContextOptions {
  seed?: boolean;
  config?: Partial<AppConfig>;
}

/**
 * Arma la API real sobre un MongoDB real (en memoria), con la carga inicial del caso y dobles de los
 * servicios externos. Cada contexto usa su propia base de datos.
 */
export async function createTestContext(options: TestContextOptions = {}) {
  const connection = await mongoose
    .createConnection(inject('mongoUri'), { dbName: `t_${randomUUID().slice(0, 8)}` })
    .asPromise();
  if (options.seed !== false) await seedDemoData(connection);

  const fakes = {
    clock: new FakeClock(),
    profileModel: new FakeProfileModel(),
    subtasks: new FakeSubtasks(),
    messaging: new FakeMessaging(),
    currency: new FakeCurrency(),
    storage: new MemoryStorage(),
  };
  const { logger, lines } = createMemoryLogger();
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    demoMode: true,
    testRoutes: true,
    subtasksTimeoutMs: 100,
    outboxBackoffMs: [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000],
    ...options.config,
    profileAssist: {
      ...DEFAULT_CONFIG.profileAssist,
      enabled: true,
      timeoutMs: 100,
      ...options.config?.profileAssist,
    },
  };
  const deps: AppDeps = {
    connection,
    clock: fakes.clock,
    services: { ...fakes },
    config,
    logger,
  };
  const app = createApp(deps);

  const as = (user: DemoUser | null) => {
    const withUser = (test: request.Test) => (user ? test.set('X-Demo-User', user) : test);
    return {
      get: (url: string) => withUser(request(app).get(url)),
      post: (url: string) => withUser(request(app).post(url)),
      put: (url: string) => withUser(request(app).put(url)),
      patch: (url: string) => withUser(request(app).patch(url)),
      delete: (url: string) => withUser(request(app).delete(url)),
    };
  };

  return {
    app,
    deps,
    fakes,
    connection,
    logLines: lines,
    as,
    ines: as('ines'),
    async close() {
      await connection.dropDatabase();
      await connection.close();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

/** Inés acepta el primer paso (burletes) y lo completa el 2026-07-08. Devuelve el id del plan nuevo. */
export async function acceptAndCompleteBurletes(ctx: TestContext): Promise<string> {
  const accepted = await ctx.ines.post('/first-step/decision').send({ action: 'accept' }).expect(201);
  const planId = accepted.body.plan.id as string;
  await ctx.ines
    .patch(`/user-eco-card/${planId}`)
    .send({ status: 'completed', implementedAt: INES_IMPLEMENTED_AT })
    .expect(200);
  return planId;
}

/** Las facturas llegan después de su cierre: el reloj de la prueba avanza a esa fecha si está antes. */
export function advanceClockTo(ctx: TestContext, date: IsoDate): void {
  if (compareDates(ctx.fakes.clock.today(), date) < 0) ctx.fakes.clock.set(date);
}

/** Sube las facturas sintéticas de la simulación con foto correcta (cada una 5 días después de su cierre). */
export async function uploadSimulatedBills(
  ctx: TestContext,
  months: ('jul' | 'ago' | 'sep')[],
): Promise<Record<string, string>> {
  const index = { jul: 0, ago: 1, sep: 2 } as const;
  const ids: Record<string, string> = {};
  for (const m of months) {
    const { kwhConsumed, costPerKwh, billingStartDate, billingEndDate } = INES_BILLS_SIMULATED[index[m]]!;
    advanceClockTo(ctx, addDays(billingEndDate, 5));
    const upload = await ctx.ines
      .post('/uploads')
      .attach('file', TINY_PNG, { filename: `${m}.png`, contentType: 'image/png' })
      .expect(201);
    const res = await ctx.ines
      .post('/user-bill')
      .send({
        serviceType: 'electricity',
        kwhConsumed,
        costPerKwh,
        billingStartDate,
        billingEndDate,
        uploadedFiles: [upload.body.fileId],
        photoQuality: 'ok',
      })
      .expect(201);
    ids[m] = res.body.id as string;
  }
  return ids;
}
