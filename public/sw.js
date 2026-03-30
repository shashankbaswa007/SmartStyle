const STATIC_CACHE = 'smartstyle-static-v8';
const OFFLINE_FALLBACK_URL = '/offline.html';

const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

const STATIC_ASSETS = [
  '/',
  OFFLINE_FALLBACK_URL,
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

function debugLog(...args) {
  if (IS_DEV) {
    console.log('[Service Worker]', ...args);
  }
}

function debugError(...args) {
  if (IS_DEV) {
    console.error('[Service Worker]', ...args);
  }
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAssetRequest(url, request) {
  if (!isSameOrigin(url)) return false;
  if (isNavigationRequest(request)) return false;
  if (isApiRequest(url)) return false;
  if (url.pathname.startsWith('/_next/')) return false;
  if (request.headers.has('authorization')) return false;

  return (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'worker' ||
    request.destination === 'manifest' ||
    request.destination === 'image'
  );
}

self.addEventListener('install', (event) => {
  debugLog('Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (error) {
        debugError('Failed to cache install assets', error);
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  debugLog('Activating...');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    debugError('Navigation fetch failed', error);
    const fallback = await caches.match(OFFLINE_FALLBACK_URL);
    if (fallback) return fallback;

    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function handleApiRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    debugError('API fetch failed', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Network unavailable',
        code: 'NETWORK_UNAVAILABLE',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleStaticAssetRequest(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (error) {
    debugError('Static asset fetch failed', error);

    if (request.destination === 'image') {
      const iconFallback = await caches.match('/icons/icon-192x192.png');
      if (iconFallback) return iconFallback;
    }

    return new Response('Resource unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isApiRequest(url)) {
    if (url.pathname === '/api/recommend' || request.headers.has('authorization')) {
      // Keep authenticated and recommendation flows out of SW interception.
      return;
    }
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (isStaticAssetRequest(url, request)) {
    event.respondWith(handleStaticAssetRequest(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(() =>
      new Response('Unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

debugLog('Loaded successfully');
