'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import AppEntryLoader from '@/components/AppEntryLoader';
import { APP_LOADER_SESSION_KEY } from '@/lib/branding';

const FULL_MOTION_MIN_VISIBLE_MS = 2600;
const FULL_MOTION_MAX_VISIBLE_MS = 4300;
const REDUCED_MOTION_MIN_VISIBLE_MS = 320;
const REDUCED_MOTION_MAX_VISIBLE_MS = 920;
const APP_ENTRY_LOADER_VERSION = 'cinematic-v3';

function getEntryLoaderStorageKey() {
  return `${APP_LOADER_SESSION_KEY}:${APP_ENTRY_LOADER_VERSION}`;
}

/**
 * App-level loader shown once per browser tab session.
 * The heavy-operation loader remains controlled by feature screens (style analysis).
 */
export function LoadingScreen() {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let hasShown = false;
    const storageKey = getEntryLoaderStorageKey();

    try {
      hasShown = window.sessionStorage.getItem(storageKey) === '1';
    } catch {
      hasShown = false;
    }

    if (hasShown) {
      setShowLoading(false);
      return;
    }

    setShowLoading(true);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minVisibleMs = prefersReducedMotion
      ? REDUCED_MOTION_MIN_VISIBLE_MS
      : FULL_MOTION_MIN_VISIBLE_MS;
    const maxVisibleMs = prefersReducedMotion
      ? REDUCED_MOTION_MAX_VISIBLE_MS
      : FULL_MOTION_MAX_VISIBLE_MS;

    let dismissed = false;
    let appReady = document.readyState === 'complete';
    let minDurationReached = false;

    const dismissLoader = () => {
      if (dismissed) return;
      dismissed = true;

      try {
        // Persist only after the loader actually displayed; avoids StrictMode double-invoke suppression in dev.
        window.sessionStorage.setItem(storageKey, '1');
      } catch {
        // Ignore storage failures (private mode / restricted environments).
      }

      setShowLoading(false);
    };

    const dismissWhenReady = () => {
      if (!appReady || !minDurationReached) {
        return;
      }

      dismissLoader();
    };

    const markAppAsReady = () => {
      appReady = true;
      dismissWhenReady();
    };

    const minDurationTimer = window.setTimeout(() => {
      minDurationReached = true;
      dismissWhenReady();
    }, minVisibleMs);

    if (appReady) {
      dismissWhenReady();
    } else {
      window.addEventListener('load', markAppAsReady, { once: true });
    }

    const hardStopTimer = window.setTimeout(dismissLoader, maxVisibleMs);

    return () => {
      window.clearTimeout(minDurationTimer);
      window.clearTimeout(hardStopTimer);
      window.removeEventListener('load', markAppAsReady);
    };
  }, []);

  return (
    <AnimatePresence>
      {showLoading && (
        <motion.div
          key="loading-screen"
          className="fixed inset-0"
          style={{ zIndex: 9999 }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.46, ease: 'easeOut' }}
        >
          <AppEntryLoader />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoadingScreen;
