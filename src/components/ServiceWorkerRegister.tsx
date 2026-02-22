'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function ServiceWorkerRegister() {
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
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
            });
          });
        })
        .catch((error) => {
        });

      // Handle controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
        }
      });
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
