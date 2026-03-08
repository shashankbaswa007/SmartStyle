import { test, expect } from '@playwright/test';

test.describe('SmartStyle Smoke Tests', () => {
  test('homepage loads and shows app title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SmartStyle/i);
    await expect(page.locator('text=SmartStyle')).toBeVisible();
  });

  test('homepage has navigation to Style Check', async ({ page }) => {
    await page.goto('/');
    const styleCheckLink = page.locator('a[href="/style-check"], button:has-text("Style Check"), a:has-text("Style")');
    await expect(styleCheckLink.first()).toBeVisible();
  });

  test('auth page loads', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('text=/sign in|log in|get started/i').first()).toBeVisible();
  });

  test('color match page loads', async ({ page }) => {
    await page.goto('/color-match');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('text=/not found|404/i').first()).toBeVisible();
  });

  test('app is responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('text=SmartStyle')).toBeVisible();
  });
});
