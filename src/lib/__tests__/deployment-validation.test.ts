/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { validateProductionDeploymentEnv } from '@/lib/deployment-validation';

const ORIGINAL_ENV = { ...process.env };

describe('deployment-validation', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOW_DEV_AUTH_FALLBACK;
    delete process.env.E2E_AUTH_BYPASS;
    delete process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not report security warnings when risky flags are disabled', () => {
    const result = validateProductionDeploymentEnv();

    expect(Array.isArray(result.securityWarnings)).toBe(true);
    expect(result.securityWarnings).toHaveLength(0);
  });

  it('reports security warnings for risky production auth flags', () => {
    process.env.ALLOW_DEV_AUTH_FALLBACK = '1';
    process.env.E2E_AUTH_BYPASS = '1';
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = 'true';

    const result = validateProductionDeploymentEnv();

    expect(result.securityWarnings).toEqual(
      expect.arrayContaining([
        'ALLOW_DEV_AUTH_FALLBACK=1',
        'E2E_AUTH_BYPASS=1',
        'NEXT_PUBLIC_E2E_AUTH_BYPASS=true',
      ])
    );
  });
});
