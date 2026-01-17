/**
 * E2E Tests for Complete User Journey
 * 
 * Tests the full application flow from authentication to analytics
 */

// @ts-ignore - Playwright is installed as a devDependency
import { test, expect, Page, Route } from '@playwright/test';

interface ApiErrorResponse {
  error: string;
}

interface MockUser {
  uid: string;
  email: string;
}

test.describe('Complete User Journey', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/');
  });

  test('should complete authentication flow', async ({ page }: { page: Page }) => {
    // Navigate to auth page
    await page.click('text=Sign In');
    await expect(page).toHaveURL('/auth');

    // Fill in sign-up form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('text=Sign Up');

    // Should redirect to home after successful auth
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Sign Out')).toBeVisible();
  });

  test('should upload image and get recommendations', async ({ page }: { page: Page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({
        uid: 'test-user-123',
        email: 'test@example.com',
      }));
    });

    await page.goto('/style-check');

    // Upload test image
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/test-outfit.jpg');

    // Fill occasion and gender
    await page.selectOption('select[name="occasion"]', 'casual');
    await page.selectOption('select[name="gender"]', 'female');

    // Get recommendations
    await page.click('text=Get Recommendations');

    // Wait for loading to complete
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 30000 });

    // Verify recommendations appear
    await expect(page.locator('[data-testid="outfit-card"]')).toHaveCount(3);
    await expect(page.locator('text=Outfit 1')).toBeVisible();
  });

  test('should like outfit and see it in likes page', async ({ page }: { page: Page }) => {
    // Setup authenticated user
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({
        uid: 'test-user-123',
        email: 'test@example.com',
      }));
    });

    await page.goto('/style-check');
    
    // Wait for recommendations (assuming already loaded)
    await page.waitForSelector('[data-testid="outfit-card"]');

    // Like first outfit
    await page.locator('[data-testid="like-button"]').first().click();
    await expect(page.locator('text=Outfit saved to likes')).toBeVisible();

    // Navigate to likes page
    await page.click('text=My Likes');
    await expect(page).toHaveURL('/likes');

    // Verify liked outfit appears
    await expect(page.locator('[data-testid="liked-outfit"]')).toHaveCount(1);
  });

  test('should view analytics dashboard', async ({ page }: { page: Page }) => {
    // Setup authenticated user with data
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({
        uid: 'test-user-123',
        email: 'test@example.com',
      }));
    });

    await page.goto('/analytics');

    // Verify analytics sections
    await expect(page.locator('text=Style Analytics')).toBeVisible();
    await expect(page.locator('text=Favorite Colors')).toBeVisible();
    await expect(page.locator('text=Preferred Styles')).toBeVisible();
    await expect(page.locator('text=Top Occasions')).toBeVisible();

    // Verify charts are rendered
    await expect(page.locator('[data-testid="color-chart"]')).toBeVisible();
  });

  test('should handle image generation fallback', async ({ page }: { page: Page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({
        uid: 'test-user-123',
        email: 'test@example.com',
      }));
    });

    await page.goto('/style-check');

    // Mock API failure
    await page.route('**/api/recommend', (route: Route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Image generation failed' }),
      });
    });

    // Try to get recommendations
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/test-outfit.jpg');
    await page.click('text=Get Recommendations');

    // Should show fallback or error message
    await expect(page.locator('text=Error generating recommendations')).toBeVisible({ timeout: 10000 });
  });

  test('should handle quota exceeded gracefully', async ({ page }: { page: Page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({
        uid: 'test-user-123',
        email: 'test@example.com',
      }));
    });

    await page.goto('/style-check');

    // Mock quota exceeded
    await page.route('**/api/recommend', (route: Route) => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'API quota exceeded' }),
      });
    });

    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/test-outfit.jpg');
    await page.click('text=Get Recommendations');

    // Should show quota error
    await expect(page.locator('text=quota exceeded')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Mobile Responsive Journey', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should work on mobile viewport', async ({ page }: { page: Page }) => {
    await page.goto('/');

    // Check mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Navigate to style check
    await page.click('text=Style Check');
    await expect(page).toHaveURL('/style-check');

    // Verify upload area is mobile-friendly
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });
});
