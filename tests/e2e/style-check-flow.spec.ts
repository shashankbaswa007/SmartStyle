import { test, expect, type Page } from '@playwright/test';
import { enableE2EAuthBypass } from './helpers/auth-bypass';

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0tQAAAAASUVORK5CYII=';

async function buildStyleCheckImageBuffer(page: Page): Promise<Buffer> {
  const dataUri = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#5f6f52';
    ctx.fillRect(0, 0, 480, 720);

    for (let y = 0; y < 720; y += 40) {
      for (let x = 0; x < 480; x += 40) {
        const hue = (x + y) % 360;
        ctx.fillStyle = `hsl(${hue}, 55%, ${38 + ((x + y) % 20)}%)`;
        ctx.fillRect(x, y, 24, 24);
      }
    }

    ctx.fillStyle = '#F1B78A';
    ctx.beginPath();
    ctx.arc(240, 170, 62, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(165, 250, 150, 210);

    ctx.fillStyle = '#34495E';
    ctx.fillRect(145, 250, 22, 180);
    ctx.fillRect(313, 250, 22, 180);

    ctx.fillStyle = '#1A2A3A';
    ctx.fillRect(180, 462, 120, 180);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(214, 290, 52, 58);

    ctx.fillStyle = '#D4AF37';
    for (let i = 0; i < 12; i += 1) {
      ctx.fillRect(100 + i * 24, 560 + (i % 2) * 14, 12, 12);
    }

    return canvas.toDataURL('image/png');
  });

  const base64 = dataUri.split(',')[1] || '';
  return Buffer.from(base64, 'base64');
}

async function clearTransientGlobalError(page: Page) {
  const startupErrorHeading = page.getByRole('heading', { name: /something went wrong/i });
  const hasStartupError = await startupErrorHeading.isVisible({ timeout: 2500 }).catch(() => false);

  if (!hasStartupError) {
    return;
  }

  await page.getByRole('button', { name: /try again/i }).click();
  await expect(startupErrorHeading).toHaveCount(0, { timeout: 10000 });
}

test.describe('Style Check Flow', () => {
  test.beforeEach(async ({ context, page }) => {
    await enableE2EAuthBypass(context, page);
  });

  test('shows required image validation when submitting empty form', async ({ page }) => {
    await page.goto('/style-check');
    await clearTransientGlobalError(page);

    await expect(page.getByRole('textbox', { name: /describe the occasion/i })).toBeVisible();

    await page.getByRole('textbox', { name: /describe the occasion/i }).fill('Office day');
    await page.getByRole('textbox', { name: /define the style genre/i }).fill('Minimalist');
    await page.getByRole('button', { name: /get style advice/i }).click();

    await expect(page.getByText(/an image of your outfit is required/i)).toBeVisible();
  });

  test('completes style-check journey from input to rendered recommendations', async ({ page }) => {
    let statusCalls = 0;

    await page.route('**/api/recommend/interaction', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/api/recommend', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        headers: {
          'x-request-id': 'req-e2e-style-check',
        },
        body: JSON.stringify({
          success: true,
          requestId: 'req-e2e-style-check',
          status: 'queued',
          jobId: 'job-e2e-style-check',
          deduped: false,
        }),
      });
    });

    await page.route('**/api/recommend/status**', async (route) => {
      statusCalls += 1;

      if (statusCalls === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            requestId: 'req-e2e-style-check',
            status: 'processing',
            jobId: 'job-e2e-style-check',
            progress: {
              stage: 'images',
              imagesReady: 1,
              totalImages: 3,
            },
            partialPayload: {
              analysis: {
                feedback: 'Preparing recommendations...',
                highlights: ['Color extraction complete', 'Generating outfits'],
                colorSuggestions: [
                  { name: 'Navy', hex: '#1E3A8A' },
                  { name: 'Ivory', hex: '#F8F5F0' },
                  { name: 'Emerald', hex: '#166534' },
                ],
                outfitRecommendations: [
                  {
                    title: 'Composed Office Layers',
                    description: 'Structured layers and clean lines.',
                    colorPalette: ['#1E3A8A', '#F8F5F0', '#166534'],
                    imageUrl: null,
                  },
                ],
                notes: '',
                imagePrompt: 'office layers',
              },
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          requestId: 'req-e2e-style-check',
          status: 'completed',
          jobId: 'job-e2e-style-check',
          completedAt: Date.now(),
          payload: {
            analysis: {
              feedback:
                'Your outfit balance is strong with a clear silhouette and coordinated contrast. Build consistency by repeating one accent tone across footwear or accessories.',
              highlights: ['Strong shape alignment', 'Color ratio feels intentional'],
              colorSuggestions: [
                { name: 'Navy', hex: '#1E3A8A' },
                { name: 'Ivory', hex: '#F8F5F0' },
                { name: 'Emerald', hex: '#166534' },
              ],
              notes: 'Keep one accent element consistent.',
              imagePrompt: 'editorial street style board',
              outfitRecommendations: [
                {
                  title: 'Composed Office Layers',
                  description:
                    'Pair a navy overshirt with ivory tee and tapered trousers to keep proportion clean and office-ready. Add understated sneakers for comfortable polish across long days.',
                  items: ['overshirt', 'tee', 'tapered trousers'],
                  colorPalette: ['#1E3A8A', '#F8F5F0', '#166534'],
                  imagePrompt: 'navy overshirt with ivory tee and tapered trousers',
                  imageUrl: `data:image/png;base64,${ONE_PIXEL_PNG}`,
                  styleType: 'smart-casual',
                  occasion: 'office',
                },
                {
                  title: 'Refined Casual Balance',
                  description:
                    'Use a textured knit with straight-fit chinos to create depth without visual clutter. Ground the palette with neutral shoes and a compact shoulder bag.',
                  items: ['textured knit', 'straight chinos', 'neutral shoes'],
                  colorPalette: ['#334155', '#E2E8F0', '#0F766E'],
                  imagePrompt: 'textured knit with straight chinos and neutral shoes',
                  imageUrl: `data:image/png;base64,${ONE_PIXEL_PNG}`,
                  styleType: 'minimal',
                  occasion: 'casual',
                },
                {
                  title: 'Evening Contrast Upgrade',
                  description:
                    'Layer a darker blazer over a crisp base to increase contrast for evening settings while keeping the fit streamlined. Finish with leather details for a premium edge.',
                  items: ['dark blazer', 'crisp base', 'leather details'],
                  colorPalette: ['#111827', '#FAFAF9', '#7C2D12'],
                  imagePrompt: 'dark blazer over crisp base with premium details',
                  imageUrl: `data:image/png;base64,${ONE_PIXEL_PNG}`,
                  styleType: 'elevated',
                  occasion: 'evening',
                },
              ],
            },
          },
          recommendationId: 'rec-e2e-style-check',
          cacheSource: 'job',
          cached: false,
        }),
      });
    });

    await page.goto('/style-check');
    await clearTransientGlobalError(page);

    const fileInput = page.locator('input[type="file"]').first();
    const generatedImage = await buildStyleCheckImageBuffer(page);
    await fileInput.setInputFiles({
      name: 'style-check-person.png',
      mimeType: 'image/png',
      buffer: generatedImage,
    });

    await page.getByRole('textbox', { name: /describe the occasion/i }).fill('Office meeting');
    await page.getByRole('textbox', { name: /define the style genre/i }).fill('Minimalist');
    await page.getByRole('button', { name: /get style advice/i }).click();

    await expect(page.getByText(/composed office layers/i).first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('button', { name: /analyze another outfit/i })).toBeVisible();
  });
});
