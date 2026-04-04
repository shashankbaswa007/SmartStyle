import { test, expect } from '@playwright/test';

test.describe('Trust and Compliance Surface', () => {
  test('auth page links to legal and trust pages', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /trust center/i })).toBeVisible();
  });

  test('privacy, terms, and trust pages render key sections', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /information we collect/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /third-party and ai processing/i })).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible();
    await expect(page.getByText(/acceptable use/i)).toBeVisible();

    await page.goto('/trust');
    await expect(page.getByRole('heading', { name: /trust center/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /reliability/i })).toBeVisible();
  });
});
