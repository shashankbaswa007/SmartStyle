const CACHE_NAME = 'smartstyle-v7';
const STATIC_CACHE = 'smartstyle-static-v7';
const DYNAMIC_CACHE = 'smartstyle-dynamic-v7';
const IMAGE_CACHE = 'smartstyle-images-v7';
const WARDROBE_CACHE = 'smartstyle-wardrobe-v7';
const API_CACHE = 'smartstyle-api-v7';

// Cache duration in milliseconds
const CACHE_DURATION = {
  STATIC: 7 * 24 * 60 * 60 * 1000,  // 7 days
  DYNAMIC: 24 * 60 * 60 * 1000,      // 1 day
  IMAGE: 30 * 24 * 60 * 60 * 1000,   // 30 days
  WARDROBE: 7 * 24 * 60 * 60 * 1000, // 7 days
  API: 5 * 60 * 1000,                 // 5 minutes
};

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.error('[Service Worker] Failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE && 
                     name !== IMAGE_CACHE &&
                     name !== WARDROBE_CACHE &&
                     name !== API_CACHE;
            })
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve(),
    ])
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const acceptHeader = request.headers.get('accept') || '';
  const isRSCRequest = request.headers.get('RSC') === '1' || request.headers.has('Next-Router-State-Tree');
  const isDocumentRequest =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    acceptHeader.includes('text/html') ||
    isRSCRequest;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Next.js internal assets — they are versioned per build and must NOT be cached by the SW
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // Always bypass SW for live quota status to avoid stale/cached responses
  if (url.pathname === '/api/usage-status') {
    return;
  }

  // Skip chrome extensions and external APIs
  if (!url.origin.includes(self.location.origin) && 
      !url.origin.includes('googleapis.com') &&
      !url.origin.includes('firebaseio.com')) {
    return;
  }

  // App documents and Next.js RSC payloads must always be network-first.
  // Serving cached route payloads causes stale chunk ids after new deployments.
  if (isDocumentRequest) {
    event.respondWith(
      handleDocumentRequest(request)
    );
    return;
  }

  // Handle different types of requests
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
  } else if (url.pathname.startsWith('/api/wardrobe')) {
    event.respondWith(handleWardrobeAPIRequest(request));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

// Handle app documents and RSC payloads with strict network-first
async function handleDocumentRequest(request) {
  const isNavigate = request.mode === 'navigate';

  try {
    // Never cache route html/RSC responses — they contain build-specific chunk references.
    return await fetch(request);
  } catch (error) {
    if (isNavigate) {
      const fallback = await caches.match('/offline.html');
      if (fallback) return fallback;
    }

    return new Response('Network unavailable', { status: 503 });
  }
}

// Handle static assets (HTML, CSS, JS)
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Return cache and update in background
      fetchAndUpdateCache(request, DYNAMIC_CACHE);
      return cachedResponse;
    }

    // Fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const contentType = networkResponse.headers.get('content-type') || '';
      const shouldCache = !contentType.includes('text/html') && !contentType.includes('text/x-component');

      if (shouldCache) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // Return offline page if available
    const offlineCache = await caches.match('/offline.html');
    if (offlineCache) return offlineCache;
    
    // Return basic offline response
    return new Response(
      '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Handle image requests with aggressive caching
async function handleImageRequest(request) {
  try {
    const cachedImage = await caches.match(request);
    if (cachedImage) return cachedImage;

    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Image fetch failed:', error);
    // Return placeholder image if available
    return caches.match('/icons/icon-192x192.png');
  }
}

// Handle API requests - network first, cache fallback
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful API responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE);
      const networkResponseClone = networkResponse.clone();
      const responseWithTimestamp = new Response(networkResponseClone.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: new Headers({
          ...Object.fromEntries(networkResponseClone.headers),
          'sw-cache-time': Date.now().toString(),
        }),
      });
      cache.put(request, responseWithTimestamp.clone());
      return networkResponse;
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] API fetch failed:', error);
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check cache age
      const cacheTime = cachedResponse.headers.get('sw-cache-time');
      if (cacheTime && (Date.now() - parseInt(cacheTime)) < CACHE_DURATION.API) {
        return cachedResponse;
      }
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ error: 'Network unavailable', offline: true }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle wardrobe API requests - cache-first for offline support
async function handleWardrobeAPIRequest(request) {
  try {
    // For GET requests, try cache first (for offline viewing)
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        const cacheTime = cachedResponse.headers.get('sw-cache-time');
        if (cacheTime && (Date.now() - parseInt(cacheTime)) < CACHE_DURATION.WARDROBE) {
          // Return cached data and update in background
          fetchAndUpdateWardrobeCache(request);
          return cachedResponse;
        }
      }
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
      const cache = await caches.open(WARDROBE_CACHE);
      const networkResponseClone = networkResponse.clone();
      const responseWithTimestamp = new Response(networkResponseClone.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: new Headers({
          ...Object.fromEntries(networkResponseClone.headers),
          'sw-cache-time': Date.now().toString(),
        }),
      });
      cache.put(request, responseWithTimestamp.clone());
      return networkResponse;
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Wardrobe API fetch failed:', error);
    
    // For offline mode, return cached data
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return empty array for wardrobe items when offline
    return new Response(
      JSON.stringify([]),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'X-Offline-Mode': 'true',
        } 
      }
    );
  }
}

// Background wardrobe cache update
async function fetchAndUpdateWardrobeCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(WARDROBE_CACHE);
      const networkResponseClone = networkResponse.clone();
      const responseWithTimestamp = new Response(networkResponseClone.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: new Headers({
          ...Object.fromEntries(networkResponseClone.headers),
          'sw-cache-time': Date.now().toString(),
        }),
      });
      cache.put(request, responseWithTimestamp.clone());
    }
  } catch (error) {
    // Silent fail for background updates
  }
}

// Background cache update
async function fetchAndUpdateCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    // Silent fail for background updates
  }
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

console.log('[Service Worker] Loaded successfully');
