import { coercePublicBooleanFlag } from '@/lib/public-rollout-flags';

describe('public rollout flags', () => {
  it('returns default when value is undefined', () => {
    expect(coercePublicBooleanFlag(undefined, true)).toBe(true);
    expect(coercePublicBooleanFlag(undefined, false)).toBe(false);
  });

  it('treats explicit false-like values as disabled', () => {
    expect(coercePublicBooleanFlag('0', true)).toBe(false);
    expect(coercePublicBooleanFlag('false', true)).toBe(false);
    expect(coercePublicBooleanFlag('off', true)).toBe(false);
    expect(coercePublicBooleanFlag('no', true)).toBe(false);
  });

  it('treats non-false values as enabled', () => {
    expect(coercePublicBooleanFlag('1', false)).toBe(true);
    expect(coercePublicBooleanFlag('true', false)).toBe(true);
    expect(coercePublicBooleanFlag('yes', false)).toBe(true);
    expect(coercePublicBooleanFlag('enabled', false)).toBe(true);
  });
});
