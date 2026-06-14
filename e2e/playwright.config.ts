import path from 'path';

import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = 24336;
const E2E_DATA_DIR = path.join(__dirname, '.test-data');

export const testConfig = {
  port: E2E_PORT,
  dataDir: E2E_DATA_DIR,
  baseURL: `http://localhost:${E2E_PORT}`,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60000,

  globalSetup: './global-setup.ts',

  use: {
    baseURL: testConfig.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `AIDER_DESK_PORT=${E2E_PORT} AIDER_DESK_DATA_DIR=${E2E_DATA_DIR} npm run start:server`,
    url: testConfig.baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  outputDir: './test-results',
});
