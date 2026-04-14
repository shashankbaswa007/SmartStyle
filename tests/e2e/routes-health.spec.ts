import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function expectAuthPageReady(page: Page) {
  const authButton = page.getByRole('button', { name: /continue with google/i });
  try {
    await expect(authButton).toBeVisible({ timeout: 12000 });
    return;
  } catch {
    await expect(page.getByText(/your personal style assistant/i).first()).toBeVisible({ timeout: 12000 });
  }
}

const publicRoutes = [
  { path: '/auth', check: async (page: Page) => expectAuthPageReady(page) },
  { path: '/privacy', check: async (page: Page) => expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible() },
  { path: '/terms', check: async (page: Page) => expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible() },
  { path: '/trust', check: async (page: Page) => expect(page.getByRole('heading', { name: /trust center/i })).toBeVisible() },
];

const protectedRoutes = ['/analytics', '/likes', '/wardrobe', '/wardrobe/suggest', '/style-check', '/account-settings'];
const clientGatedRoutes = ['/color-match'];
const demoDisabledRoutes = ['/preferences', '/saved-palettes', '/test-analytics'];

test.describe('Route Health', () => {
  test('root redirects unauthenticated users to auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth/);
  });

  for (const route of publicRoutes) {
    test(`public route ${route.path} renders`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(route.path);
      await route.check(page);
    });
  }

  for (const path of protectedRoutes) {
    test(`protected route ${path} redirects to auth with next`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(path);

      await expect(page).toHaveURL(/\/auth\?next=/);
      const url = new URL(page.url());
      expect(url.searchParams.get('next')).toBe(path);
    });
  }

  for (const path of clientGatedRoutes) {
    test(`client-gated route ${path} requires auth`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(path);
      await expectAuthPageReady(page);
    });
  }

  for (const path of demoDisabledRoutes) {
    test(`demo-disabled route ${path} redirects home`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(path);

      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      await expect(page).toHaveURL(/\/(?:$|auth(?:\?|$))/);
    });
  }

  test('unknown route renders not found page', async ({ page }) => {
    await page.goto('/not-a-real-page');
    await expect(page.locator('text=/not found|404/i').first()).toBeVisible();
  });
});
