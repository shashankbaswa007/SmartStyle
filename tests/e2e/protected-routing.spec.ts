import { test, expect } from '@playwright/test';

const protectedRoutesWithNext = ['/likes', '/wardrobe', '/style-check'];
const demoDisabledRoutes = ['/analytics', '/preferences', '/saved-palettes', '/account-settings'];

test.describe('Protected Routing', () => {
  for (const path of protectedRoutesWithNext) {
    test(`redirects unauthenticated users from ${path}`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(path);

      await expect(page).toHaveURL(/\/auth\?next=/);
      const url = new URL(page.url());
      expect(url.searchParams.get('next')).toBe(path);
    });
  }

  for (const path of demoDisabledRoutes) {
    test(`redirects demo-disabled route ${path} to home`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(path);

      await expect(page).toHaveURL(/\/$/);
    });
  }
});
