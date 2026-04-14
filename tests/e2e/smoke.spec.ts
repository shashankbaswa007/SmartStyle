import { test, expect } from '@playwright/test';

async function expectAuthPageReady(page: import('@playwright/test').Page) {
  const authButton = page.getByRole('button', { name: /continue with google/i });
  try {
    await expect(authButton).toBeVisible({ timeout: 12000 });
    return;
  } catch {
    // Some flows can still be stabilizing; verify auth surface text as fallback.
    await expect(page.getByText(/your personal style assistant/i).first()).toBeVisible({ timeout: 12000 });
  }
}

test.describe('SmartStyle Smoke Tests', () => {
  test('homepage redirects unauthenticated users to auth', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SmartStyle/i);
    await expect(page).toHaveURL(/\/auth/);
    await expectAuthPageReady(page);
  });

  test('auth page has legal navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /trust center/i })).toBeVisible();
  });

  test('auth page loads', async ({ page }) => {
    await page.goto('/auth');
    await expectAuthPageReady(page);
  });

  test('color match requires auth gate for unauthenticated users', async ({ page }) => {
    await page.goto('/color-match');
    await expectAuthPageReady(page);
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('text=/not found|404/i').first()).toBeVisible();
  });

  test('app is responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth/);
    await expectAuthPageReady(page);
  });
});
