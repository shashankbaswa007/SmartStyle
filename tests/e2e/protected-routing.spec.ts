import { test, expect } from '@playwright/test';

const protectedRoutes = [
  '/analytics',
  '/likes',
  '/preferences',
  '/saved-palettes',
  '/wardrobe',
  '/account-settings',
  '/style-check',
];

test.describe('Protected Routing', () => {
  for (const path of protectedRoutes) {
    test(`redirects unauthenticated users from ${path}`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(path);

      await expect(page).toHaveURL(/\/auth\?next=/);
      const url = new URL(page.url());
      expect(url.searchParams.get('next')).toBe(path);
    });
  }
});
