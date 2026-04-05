import type { BrowserContext, Page } from '@playwright/test';

const AUTH_BYPASS_COOKIE = {
  name: 'smartstyle-e2e-auth',
  value: 'enabled',
  domain: 'localhost',
  path: '/',
  httpOnly: false,
  secure: false,
  sameSite: 'Lax' as const,
};

export async function enableE2EAuthBypass(context: BrowserContext, page: Page) {
  await context.addCookies([AUTH_BYPASS_COOKIE]);
}
