import { defineConfig } from '@playwright/test';

// Servidor de fixtures em QA_PORT (4120), gerido por tests/e2e/helpers/global-setup.ts.
// Não usa a porta 4100 para não colidir com o servidor de desenvolvimento em uso.
export const QA_PORT = Number(process.env.QA_PORT ?? 4120);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  globalSetup: './tests/e2e/helpers/global-setup.ts',
  globalTeardown: './tests/e2e/helpers/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${QA_PORT}`,
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', testMatch: /mobile\.spec\.ts/, use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
  ],
});
