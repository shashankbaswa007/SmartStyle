import type { BrowserContext, Page } from '@playwright/test';

const AUTH_BYPASS_COOKIE_NAME = 'smartstyle-e2e-auth';

function resolveAuthBypassUrl(): string {
  return process.env.PLAYWRIGHT_AUTH_BYPASS_URL || 'http://localhost:3000';
}

export async function enableE2EAuthBypass(context: BrowserContext, page: Page) {
  await context.addCookies([
    {
      name: AUTH_BYPASS_COOKIE_NAME,
      value: 'enabled',
      url: resolveAuthBypassUrl(),
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ]);
}
