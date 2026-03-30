'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function ServiceWorkerRegister() {
  const { toast } = useToast();

  useEffect(() => {
    const isLocalHost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    const shouldDisableServiceWorker = process.env.NODE_ENV !== 'production' || isLocalHost;

    let unregisterControllerChange: (() => void) | null = null;
    let unregisterMessage: (() => void) | null = null;

    if ('serviceWorker' in navigator && shouldDisableServiceWorker) {
      // In local/dev, ensure no stale SW keeps intercepting requests.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith('smartstyle-')).map((key) => caches.delete(key))))
          .catch(() => {});
      }
    }

    if ('serviceWorker' in navigator && !shouldDisableServiceWorker) {
      let refreshing = false;
      let isMounted = true;
      let unregisterUpdateFound: (() => void) | null = null;
      let unregisterWorkerStateChange: (() => void) | null = null;

      const handleControllerChange = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };

      const handleSwMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
          // Intentionally no-op in production UI flow.
        }
      };

      unregisterControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };

      unregisterMessage = () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.addEventListener('message', handleSwMessage);

      navigator.serviceWorker
        .getRegistration('/sw.js')
        .then((existing) => existing || navigator.serviceWorker.register('/sw.js'))
        .then((registration) => {
          if (!isMounted) return;

          // Check for a newer SW script on every page load in production.
          registration.update().catch(() => {});

          const handleUpdateFound = () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            const handleWorkerStateChange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Activate update immediately to avoid stale route/chunk manifests.
                newWorker.postMessage({ type: 'SKIP_WAITING' });

                // New service worker available
                toast({
                  title: 'Update Available',
                  description: 'A new version is ready. Refresh to update.',
                  action: (
                    <button
                      onClick={() => window.location.reload()}
                      className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm"
                    >
                      Refresh
                    </button>
                  ),
                  duration: 10000,
                });
              }
            };

            unregisterWorkerStateChange?.();
            newWorker.addEventListener('statechange', handleWorkerStateChange);
            unregisterWorkerStateChange = () => {
              newWorker.removeEventListener('statechange', handleWorkerStateChange);
            };
          };

          registration.addEventListener('updatefound', handleUpdateFound);
          unregisterUpdateFound = () => {
            registration.removeEventListener('updatefound', handleUpdateFound);
          };
        })
        .catch(() => {});

      return () => {
        isMounted = false;
        unregisterUpdateFound?.();
        unregisterWorkerStateChange?.();
        unregisterControllerChange?.();
        unregisterMessage?.();
      };
    }

    // Handle online/offline status
    const handleOnline = () => {
      toast({
        title: 'Back Online',
        description: 'Your connection has been restored.',
        duration: 3000,
      });
    };

    const handleOffline = () => {
      toast({
        title: 'You\'re Offline',
        description: 'Some features may be limited.',
        variant: 'destructive',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  return null;
}
