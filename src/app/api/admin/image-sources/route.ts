import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/server-auth';
import { validateRequestOrigin } from '@/lib/csrf-protection';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type ProviderStatus = {
  configured: boolean;
  ok: boolean;
  detail: string;
  latencyMs?: number;
};

type ImageSourcesResponse = {
  success: true;
  timestamp: string;
  probeEnabled: boolean;
  sources: {
    pollinations: ProviderStatus;
    together: ProviderStatus;
    replicate: ProviderStatus;
    orchestrator: ProviderStatus;
  };
};

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const start = Date.now();
  const value = await work();
  return { value, latencyMs: Date.now() - start };
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function checkPollinations(probe: boolean, prompt: string, colors: string[]): Promise<ProviderStatus> {
  const { isPollinationsAuthenticated, generateOutfitImageWithFallback } = await import('@/lib/image-generation');
  const configured = isPollinationsAuthenticated();
  if (!configured) {
    return {
      configured,
      ok: false,
      detail: 'POLLINATIONS_API_KEY missing',
    };
  }

  if (!probe) {
    return {
      configured,
      ok: true,
      detail: 'Configured (probe skipped)',
    };
  }

  try {
    const { value, latencyMs } = await timed(async () =>
      withTimeout(generateOutfitImageWithFallback(prompt, colors), 12000)
    );

    const ok = Boolean(value && value.startsWith('data:image/'));
    return {
      configured,
      ok,
      detail: ok ? 'Generated image data URI successfully' : 'No image generated',
      latencyMs,
    };
  } catch (error) {
    return {
      configured,
      ok: false,
      detail: messageFromError(error),
    };
  }
}

async function checkTogether(probe: boolean, prompt: string, colors: string[]): Promise<ProviderStatus> {
  const { isTogetherAvailable, generateWithTogether } = await import('@/lib/together-image');
  const configured = isTogetherAvailable();
  if (!configured) {
    return {
      configured,
      ok: false,
      detail: 'TOGETHER_API_KEY missing',
    };
  }

  if (!probe) {
    return {
      configured,
      ok: true,
      detail: 'Configured (probe skipped)',
    };
  }

  try {
    const { value, latencyMs } = await timed(async () =>
      withTimeout(generateWithTogether(prompt, colors), 9000)
    );

    const ok = Boolean(value && (value.startsWith('http') || value.startsWith('data:image/')));
    return {
      configured,
      ok,
      detail: ok ? 'Generated image URL successfully' : 'No image generated',
      latencyMs,
    };
  } catch (error) {
    return {
      configured,
      ok: false,
      detail: messageFromError(error),
    };
  }
}

async function checkReplicate(probe: boolean, prompt: string, colors: string[]): Promise<ProviderStatus> {
  const { isReplicateAvailable, generateWithReplicate } = await import('@/lib/replicate-image');
  const configured = isReplicateAvailable();
  if (!configured) {
    return {
      configured,
      ok: false,
      detail: 'REPLICATE_API_TOKEN missing',
    };
  }

  if (!probe) {
    return {
      configured,
      ok: true,
      detail: 'Configured (probe skipped)',
    };
  }

  try {
    const { value, latencyMs } = await timed(async () =>
      withTimeout(generateWithReplicate(prompt, colors), 12000)
    );

    const ok = Boolean(value && (value.startsWith('http') || value.startsWith('data:image/')));
    return {
      configured,
      ok,
      detail: ok ? 'Generated image URL successfully' : 'No image generated',
      latencyMs,
    };
  } catch (error) {
    return {
      configured,
      ok: false,
      detail: messageFromError(error),
    };
  }
}

async function checkOrchestrator(probe: boolean, prompt: string, colors: string[]): Promise<ProviderStatus> {
  const { generateImageWithRetry } = await import('@/lib/smart-image-generation');
  if (!probe) {
    return {
      configured: true,
      ok: true,
      detail: 'Available (probe skipped)',
    };
  }

  try {
    const { value, latencyMs } = await timed(async () =>
      withTimeout(generateImageWithRetry(prompt, colors, 12000), 13000)
    );

    const ok = Boolean(value);
    let sourceHint = 'svg-placeholder';
    if (value.includes('together.ai') || value.includes('together.xyz')) sourceHint = 'together';
    if (value.includes('replicate.delivery')) sourceHint = 'replicate';
    if (value.startsWith('data:image/') && !value.includes('Image generation unavailable')) sourceHint = 'pollinations-auth';
    if (value.includes('Image generation unavailable')) sourceHint = 'svg-placeholder';

    return {
      configured: true,
      ok,
      detail: `Generated result successfully (source=${sourceHint})`,
      latencyMs,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      detail: messageFromError(error),
    };
  }
}

export async function GET(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: 'Invalid request origin' }, { status: 403 });
  }

  try {
    const { uid: userId, source } = await verifyAdminRequest(request);
    logger.info('Admin endpoint access', {
      endpoint: '/api/admin/image-sources',
      method: 'GET',
      userId,
      authSource: source,
    });

    const url = new URL(request.url);
    const probeEnabled = url.searchParams.get('probe') === '1';

    const prompt = 'A clean minimalist smart casual outfit on mannequin, studio white background';
    const colors = ['#1E3A8A', '#F8F5F0', '#1F2937'];

    const [pollinations, together, replicate, orchestrator] = await Promise.all([
      checkPollinations(probeEnabled, prompt, colors),
      checkTogether(probeEnabled, prompt, colors),
      checkReplicate(probeEnabled, prompt, colors),
      checkOrchestrator(probeEnabled, prompt, colors),
    ]);

    const body: ImageSourcesResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      probeEnabled,
      sources: {
        pollinations,
        together,
        replicate,
        orchestrator,
      },
    };

    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to evaluate image sources' },
      { status: 500 }
    );
  }
}
