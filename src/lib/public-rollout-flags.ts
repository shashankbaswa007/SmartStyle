function coercePublicBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;

  const normalized = value.trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(normalized);
}

export const publicRolloutFlags = {
  premiumStyleCheckLoader: coercePublicBooleanFlag(
    process.env.NEXT_PUBLIC_STYLE_CHECK_PREMIUM_LOADER,
    true
  ),
  premiumAuthLoader: coercePublicBooleanFlag(
    process.env.NEXT_PUBLIC_AUTH_PREMIUM_LOADER,
    true
  ),
} as const;

export { coercePublicBooleanFlag };
