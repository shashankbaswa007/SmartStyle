import { test, expect } from '@playwright/test';

test.describe('Color Match Recovery UX', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: 'smartstyle-e2e-auth',
        value: 'enabled',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/');
  });

  test('shows retryable error state and recovers after valid retry', async ({ page }) => {
    await page.goto('/color-match');

    const startupErrorHeading = page.getByRole('heading', { name: /something went wrong/i });
    const hasStartupError = await startupErrorHeading.isVisible({ timeout: 2500 }).catch(() => false);
    if (hasStartupError) {
      await page.getByRole('button', { name: /try again/i }).click();
    }

    const colorInput = page.locator('input[type="text"]').first();
    await expect(colorInput).toBeVisible({ timeout: 15000 });

    await colorInput.fill('not-a-valid-color-value');
    await page.getByRole('button', { name: /^find matches$/i }).click();

    await expect(page.getByText(/unable to generate palette/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^retry$/i })).toBeVisible();

    await colorInput.fill('#7c3aed');
    await page.getByRole('button', { name: /^retry$/i }).click();

    await expect(page.getByText(/best color matches/i)).toBeVisible();
    await expect(page.getByText(/unable to generate palette/i)).toHaveCount(0);
  });
});
