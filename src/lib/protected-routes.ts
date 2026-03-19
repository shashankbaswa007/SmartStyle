export const PROTECTED_PATH_PREFIXES = [
  '/analytics',
  '/likes',
  '/preferences',
  '/saved-palettes',
  '/wardrobe',
  '/account-settings',
  '/style-check',
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}
