import { test, expect } from '@playwright/test';

test.describe('Color Match Recovery UX', () => {
  test('shows retryable error state and recovers after valid retry', async ({ page }) => {
    await page.goto('/color-match');
    const inputCount = await page.locator('input[type="text"]').count();
    test.skip(inputCount === 0, 'Requires authenticated access and available color-match form in this environment.');

    const colorInput = page.locator('input[type="text"]').first();

    await colorInput.fill('not-a-valid-color-value');
    await page.getByRole('button', { name: /find matches/i }).click();

    await expect(page.getByText(/unable to generate palette/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^retry$/i })).toBeVisible();

    await colorInput.fill('#7c3aed');
    await page.getByRole('button', { name: /^retry$/i }).click();

    await expect(page.getByText(/best color matches/i)).toBeVisible();
    await expect(page.getByText(/unable to generate palette/i)).toHaveCount(0);
  });
});
