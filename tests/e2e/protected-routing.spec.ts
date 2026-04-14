import { test, expect } from '@playwright/test';

const protectedRoutesWithNext = ['/analytics', '/likes', '/wardrobe', '/wardrobe/suggest', '/style-check'];
const demoDisabledRoutes = ['/preferences', '/saved-palettes', '/account-settings', '/test-analytics'];

async function expectAuthGate(page: import('@playwright/test').Page) {
  const authButton = page.getByRole('button', { name: /continue with google/i });
  try {
    await expect(authButton).toBeVisible({ timeout: 12000 });
    return;
  } catch {
    await expect(page.getByText(/your personal style assistant/i).first()).toBeVisible({ timeout: 12000 });
  }
}

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

      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      await expect(page).toHaveURL(/\/(?:$|auth(?:\?|$))/);
    });
  }

  test('auth-gates /color-match for unauthenticated users', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/color-match');

    await expectAuthGate(page);
  });
});
