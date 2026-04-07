const DEV_ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const envOrigins = parseOriginList(process.env.CSRF_ALLOWED_ORIGINS);

  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) {
    origins.add(requestOrigin);
  }

  const normalizedAppOrigin = appUrl ? normalizeOrigin(appUrl) : null;
  if (normalizedAppOrigin) {
    origins.add(normalizedAppOrigin);
  }

  for (const origin of envOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      origins.add(normalized);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    for (const origin of DEV_ALLOWED_ORIGINS) {
      origins.add(origin);
    }
  }

  return origins;
}

export function validateRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return getAllowedOrigins(request).has(normalizedOrigin);
}
