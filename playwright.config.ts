import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'E2E_AUTH_BYPASS=1 NEXT_PUBLIC_E2E_AUTH_BYPASS=true npm run build && E2E_AUTH_BYPASS=1 NEXT_PUBLIC_E2E_AUTH_BYPASS=true npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 300 * 1000,
  },
});
