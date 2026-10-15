import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import pino from 'pino';
import { DEMO_TODAY } from '@ppam/fixtures';
import { createApp, type AppDeps } from './app.js';
import { DemoClock, SystemClock } from './clock.js';
import { loadAiConfig, loadConfig, loadServiceUrls } from './config.js';
import { getModels } from './db/models.js';
import { seedDemoData } from './seed/index.js';
import { DiskStorage, HttpCurrency, HttpMessaging, HttpSubtasks } from './services/http.js';
import { OpenAiProfileModel } from './services/profile-model.js';
import { processOutbox, recomputePeerStats, scheduleBillReminders } from './workers/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/** MongoDB: `MONGODB_URI` si existe; si no, uno embebido en modo réplica (transacciones) y persistente en ./.data. */
async function startDatabase(uri: string | null): Promise<{ uri: string; stop: () => Promise<void> }> {
  if (uri) return { uri, stop: async () => undefined };
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  const dbPath = path.join(root, '.data', 'mongo');
  await mkdir(dbPath, { recursive: true });
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ dbPath, port: Number(process.env.MONGO_PORT ?? 27_117) }],
  });
  logger.info({ dbPath }, 'MongoDB embebido en modo réplica');
  return {
    uri: replSet.getUri(),
    stop: async () => {
      await replSet.stop({ doCleanup: false });
    },
  };
}

async function main() {
  const config = loadConfig(process.env);
  const ai = config.profileAssist.enabled ? loadAiConfig(process.env) : null;
  const urls = loadServiceUrls(process.env);
  const db = await startDatabase(config.mongoUri);
  const connection = await mongoose
    .createConnection(db.uri, { dbName: process.env.MONGODB_DB ?? 'kamai_primer_paso' })
    .asPromise();

  const m = getModels(connection);
  if ((await m.Business.estimatedDocumentCount().catch(() => 0)) === 0) {
    logger.info('Base vacía: cargando los datos del caso y los sintéticos');
    await seedDemoData(connection);
  }

  const demoClock = config.demoMode
    ? new DemoClock(
        ((await m.Setting.findById('demoToday').lean())?.value as string | undefined) ?? DEMO_TODAY,
      )
    : null;
  const deps: AppDeps = {
    connection,
    clock: demoClock ?? new SystemClock(),
    config,
    logger,
    services: {
      profileModel: ai ? new OpenAiProfileModel(ai) : null,
      subtasks: new HttpSubtasks(urls.subtasksUrl),
      messaging: new HttpMessaging(config.messaging.url, config.messaging.apiKey),
      currency: new HttpCurrency(config.currencyUrl),
      storage: new DiskStorage(path.join(root, '.data', 'uploads')),
    },
    demo: demoClock
      ? {
          mocksControlUrl: urls.mocksControlUrl,
          async setToday(date: string) {
            demoClock.set(date);
            await m.Setting.updateOne({ _id: 'demoToday' }, { $set: { value: date } }, { upsert: true });
          },
        }
      : undefined,
  };

  const app = createApp(deps);
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, demoMode: config.demoMode, ai: ai ? ai.model : 'palabras clave' },
      `API en http://localhost:${config.port}`,
    );
  });

  // Workers: bandeja de correos cada 30 s, recordatorios cada hora y estadísticas de pares una vez por día.
  const every = (ms: number, task: () => Promise<unknown>, name: string) =>
    setInterval(() => {
      task().catch((err: unknown) => logger.error({ err, worker: name }, 'Falló un worker'));
    }, ms).unref();
  every(30_000, () => processOutbox(deps), 'outbox');
  every(3_600_000, () => scheduleBillReminders(deps), 'reminders');
  every(86_400_000, () => recomputePeerStats(deps), 'peer-stats');

  const shutdown = async () => {
    server.close();
    await connection.close().catch(() => undefined);
    await db.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'La API no pudo arrancar');
  process.exit(1);
});
