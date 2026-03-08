'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // ── Daily frequency cap: max 2 prompts per day ──
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const storedData = localStorage.getItem('pwa-install-prompts');
    let promptData: { date: string; count: number } = { date: today, count: 0 };

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.date === today) {
          promptData = parsed;
        }
      } catch {
        // corrupted data, reset
      }
    }

    // Already shown twice today — don't show again
    if (promptData.count >= 2) return;

    // Already dismissed in this session
    if (sessionStorage.getItem('pwa-install-session-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after 30 seconds of usage
      setTimeout(() => {
        // Re-check count in case it changed while waiting
        const current = localStorage.getItem('pwa-install-prompts');
        let currentData: { date: string; count: number } = { date: today, count: 0 };
        if (current) {
          try {
            const p = JSON.parse(current);
            if (p.date === today) currentData = p;
          } catch { /* reset */ }
        }
        if (currentData.count >= 2) return;
        if (sessionStorage.getItem('pwa-install-session-dismissed')) return;

        // Increment count and show
        currentData.count += 1;
        localStorage.setItem('pwa-install-prompts', JSON.stringify(currentData));
        setShowInstallPrompt(true);
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
    } else {
      // Dismissed via native prompt — mark session so it doesn't pop up again
      sessionStorage.setItem('pwa-install-session-dismissed', '1');
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Mark dismissed for this session so it won't reappear
    sessionStorage.setItem('pwa-install-session-dismissed', '1');
  };

  if (isInstalled || !showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-md rounded-lg border border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1">
              Install SmartStyle
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Get instant access, work offline, and enjoy a native app experience!
            </p>
            
            <div className="flex gap-2">
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="flex-1"
              >
                Install Now
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                Maybe Later
              </Button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
