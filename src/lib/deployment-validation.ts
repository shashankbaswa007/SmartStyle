import { logger } from '@/lib/logger';

let hasValidated = false;

export interface DeploymentValidationResult {
  platform: 'vercel' | 'other';
  missingCritical: string[];
  missingRecommended: string[];
  securityWarnings: string[];
}

function detectPlatform(): 'vercel' | 'other' {
  return process.env.VERCEL ? 'vercel' : 'other';
}

function hasFirebaseAdminCredentials(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

function hasAtLeastOneAiProvider(): boolean {
  return Boolean(process.env.GROQ_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
}

export function validateProductionDeploymentEnv(): DeploymentValidationResult {
  const platform = detectPlatform();

  const missingCritical: string[] = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    missingCritical.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  }
  if (!hasFirebaseAdminCredentials()) {
    missingCritical.push('FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS');
  }
  if (!hasAtLeastOneAiProvider()) {
    missingCritical.push('GROQ_API_KEY or GOOGLE_GENAI_API_KEY');
  }

  const missingRecommended: string[] = [];
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    missingRecommended.push('UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN');
  }

  const securityWarnings: string[] = [];
  if (process.env.ALLOW_DEV_AUTH_FALLBACK === '1') {
    securityWarnings.push('ALLOW_DEV_AUTH_FALLBACK=1');
  }
  if (process.env.E2E_AUTH_BYPASS === '1') {
    securityWarnings.push('E2E_AUTH_BYPASS=1');
  }
  if ((process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS || '').toLowerCase() === 'true') {
    securityWarnings.push('NEXT_PUBLIC_E2E_AUTH_BYPASS=true');
  }

  return {
    platform,
    missingCritical,
    missingRecommended,
    securityWarnings,
  };
}

export function validateProductionDeploymentEnvOnce(): void {
  if (hasValidated) {
    return;
  }
  hasValidated = true;

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const result = validateProductionDeploymentEnv();

  if (result.missingCritical.length > 0) {
    logger.error('Production deployment environment validation failed', {
      platform: result.platform,
      missingCritical: result.missingCritical,
    });
  } else {
    logger.info('Production deployment environment validation passed', {
      platform: result.platform,
    });
  }

  if (result.missingRecommended.length > 0) {
    logger.warn('Production deployment environment recommendations missing', {
      platform: result.platform,
      missingRecommended: result.missingRecommended,
    });
  }

  if (result.securityWarnings.length > 0) {
    logger.warn('Production deployment security flags require review', {
      platform: result.platform,
      securityWarnings: result.securityWarnings,
    });
  }
}
