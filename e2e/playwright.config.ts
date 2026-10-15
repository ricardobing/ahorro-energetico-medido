import { defineConfig, devices } from '@playwright/test';

/**
 * e2e contra la app real (`npm run dev`: API, simulaciones y web con la carga inicial del caso).
 * Celular: los recorridos de Inés. Escritorio: navegación lateral e informe para aliados.
 */
export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  outputDir: '../test-results',
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'retain-on-failure',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
  },
  projects: [
    { name: 'celular', testMatch: /ines\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    {
      name: 'escritorio',
      testMatch: /(escritorio|aliados)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    // La salud de la API a través del proxy de la web: espera a las dos, y a que la base esté cargada.
    url: 'http://localhost:5180/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DEMO_MODE: 'true' },
  },
});
