import { createMocksApp } from './app.js';

const port = Number(process.env.MOCKS_PORT ?? 4110);
const apiPort = Number(process.env.PORT ?? 4100);

const app = createMocksApp({
  messagingApiKey: process.env.MESSAGING_API_KEY ?? 'solo-desarrollo',
  bounceWebhookUrl: process.env.BOUNCE_WEBHOOK_URL ?? `http://localhost:${apiPort}/webhooks/messaging/bounce`,
});

app.listen(port, () => {
  process.stdout.write(`Simulaciones de Kamai en http://localhost:${port} (mensajería, subtareas, moneda)\n`);
});
