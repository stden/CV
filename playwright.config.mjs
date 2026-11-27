import { defineConfig, devices } from '@playwright/test';

// The site is served under /CV/ exactly as GitHub Pages serves it, so every
// test also checks the base path.
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/artifacts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/report' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/CV/`,
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/CV/`,
    reuseExistingServer: !process.env.CI
  }
});
