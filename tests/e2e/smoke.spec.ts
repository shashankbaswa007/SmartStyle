import { test, expect } from '@playwright/test';

test.describe('SmartStyle Smoke Tests', () => {
  test('homepage redirects unauthenticated users to auth', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SmartStyle/i);
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('auth page has legal navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /trust center/i })).toBeVisible();
  });

  test('auth page loads', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
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
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });
});
