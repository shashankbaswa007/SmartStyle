import { test, expect, type Page } from '@playwright/test';
import { enableE2EAuthBypass } from './helpers/auth-bypass';

async function clearTransientGlobalError(page: Page) {
  const startupErrorHeading = page.getByRole('heading', { name: /something went wrong/i });
  const hasStartupError = await startupErrorHeading.isVisible({ timeout: 2500 }).catch(() => false);

  if (!hasStartupError) {
    return;
  }

  await page.getByRole('button', { name: /try again/i }).click();
  await expect(startupErrorHeading).toHaveCount(0, { timeout: 10000 });
}

test.describe('Account Security Settings', () => {
  test.beforeEach(async ({ context, page }) => {
    await enableE2EAuthBypass(context, page);
    await page.goto('/account-settings');
    await clearTransientGlobalError(page);
  });

  test('handles reauth failure then recovery', async ({ page }) => {
    await page.getByLabel(/current password/i).fill('wrong-password');
    await page.getByRole('button', { name: /re-authenticate/i }).click();
    await expect(page.getByText(/current password is incorrect/i).first()).toBeVisible();

    await page.getByLabel(/current password/i).fill('correct-password');
    await page.getByRole('button', { name: /re-authenticate/i }).click();
    await expect(page.getByText(/current password is incorrect/i)).toHaveCount(0);
  });

  test('validates password update errors and recovers successfully', async ({ page }) => {
    await page.getByLabel(/^new password$/i).fill('new-password-123');
    await page.getByLabel(/confirm new password/i).fill('different-password');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/do not match/i).first()).toBeVisible();

    await page.getByLabel(/confirm new password/i).fill('new-password-123');
    await page.getByLabel(/current password/i).fill('wrong-password');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/current password is incorrect/i).first()).toBeVisible();

    await page.getByLabel(/current password/i).fill('correct-password');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByLabel(/^new password$/i)).toHaveValue('');
    await expect(page.getByLabel(/confirm new password/i)).toHaveValue('');
  });

  test('validates email update and supports recovery', async ({ page }) => {
    await page.getByLabel(/new email address/i).fill('not-an-email');
    await page.getByRole('button', { name: /update email/i }).click();
    await expect(page.getByText(/valid email address/i).first()).toBeVisible();

    await page.getByLabel(/new email address/i).fill('updated@example.com');
    await page.getByLabel(/current password/i).fill('correct-password');
    await page.getByRole('button', { name: /update email/i }).click();

    await expect(page.getByLabel(/new email address/i)).toHaveValue('');
  });
});
