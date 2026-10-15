import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          include: ['packages/domain/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          include: ['apps/api/test/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['apps/api/test/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'fixtures',
          include: ['packages/fixtures/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'mocks',
          include: ['apps/mocks/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      'apps/web/vite.config.ts',
      {
        test: {
          name: 'scripts',
          include: ['scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**', 'apps/api/src/**', 'apps/mocks/src/**', 'apps/web/src/**'],
      exclude: ['**/*.d.ts', 'apps/api/src/server.ts', 'apps/mocks/src/server.ts', 'apps/web/src/main.tsx'],
      thresholds: {
        'packages/domain/src/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
      },
    },
  },
});
