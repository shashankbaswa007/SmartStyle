import { test, expect, type Page } from '@playwright/test';
import { enableE2EAuthBypass } from './helpers/auth-bypass';

type FlowCheck = {
  path: string;
  assertReady: (page: Page) => Promise<void>;
};

const flowChecks: FlowCheck[] = [
  {
    path: '/analytics',
    assertReady: async (page) => {
      await expect(page.getByText(/style analytics|how to get useful analytics|no analytics data yet/i).first()).toBeVisible();
    },
  },
  {
    path: '/likes',
    assertReady: async (page) => {
      await expect(page.getByText(/your likes|no liked outfits yet/i)).toBeVisible();
    },
  },
  {
    path: '/wardrobe',
    assertReady: async (page) => {
      await expect(page.getByText(/build your smart wardrobe|let's build your digital wardrobe|my wardrobe/i).first()).toBeVisible();
    },
  },
  {
    path: '/wardrobe/suggest',
    assertReady: async (page) => {
      await expect(page.getByRole('button', { name: /get outfit suggestions/i })).toBeVisible();
    },
  },
];

async function clearTransientGlobalError(page: Page) {
  const startupErrorHeading = page.getByRole('heading', { name: /something went wrong/i });
  const hasStartupError = await startupErrorHeading.isVisible({ timeout: 2500 }).catch(() => false);

  if (!hasStartupError) {
    return;
  }

  await page.getByRole('button', { name: /try again/i }).click();
  await expect(startupErrorHeading).toHaveCount(0, { timeout: 10000 });
}

test.describe('Authenticated Flow Stability', () => {
  test.beforeEach(async ({ context, page }) => {
    await enableE2EAuthBypass(context, page);
  });

  for (const flow of flowChecks) {
    test(`renders ${flow.path} without global error boundary`, async ({ page }) => {
      await page.goto(flow.path);
      await clearTransientGlobalError(page);

      await expect(page.getByRole('heading', { name: /something went wrong/i })).toHaveCount(0);
      await flow.assertReady(page);
    });
  }
});
