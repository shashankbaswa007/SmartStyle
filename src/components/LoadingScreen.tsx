'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SmartStyleLoader from '@/components/SmartStyleLoader';
import { useMotionSettings } from '@/components/MotionProvider';
import { APP_LOADER_SESSION_KEY } from '@/lib/branding';

const INTRO_MESSAGES = [
  'Preparing your style studio...',
  'Calibrating color intelligence...',
  'Loading your SmartStyle experience...',
];

/**
 * App-level loader shown once per browser tab session.
 * The heavy-operation loader remains controlled by feature screens (style analysis).
 */
export function LoadingScreen() {
  const { prefersReducedMotion } = useMotionSettings();
  const [showLoading, setShowLoading] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let hasShown = false;

    try {
      hasShown = window.sessionStorage.getItem(APP_LOADER_SESSION_KEY) === '1';
    } catch {
      hasShown = false;
    }

    if (hasShown) {
      setShowLoading(false);
      return;
    }

    setShowLoading(true);
    setMessageIndex(0);

    try {
      window.sessionStorage.setItem(APP_LOADER_SESSION_KEY, '1');
    } catch {
      // Ignore storage failures (private mode / restricted environments).
    }

    const startedAt = performance.now();
    const minVisibleMs = prefersReducedMotion ? 180 : 780;
    const maxVisibleMs = prefersReducedMotion ? 320 : 1600;
    let dismissed = false;

    const dismissLoader = () => {
      if (dismissed) return;
      dismissed = true;
      setShowLoading(false);
    };

    const dismissWhenReady = () => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, minVisibleMs - elapsed);
      window.setTimeout(dismissLoader, remaining);
    };

    if (document.readyState === 'complete') {
      dismissWhenReady();
    } else {
      window.addEventListener('load', dismissWhenReady, { once: true });
    }

    const hardStopTimer = window.setTimeout(dismissLoader, maxVisibleMs);

    return () => {
      window.clearTimeout(hardStopTimer);
      window.removeEventListener('load', dismissWhenReady);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!showLoading || prefersReducedMotion) {
      return;
    }

    const rotateTimer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % INTRO_MESSAGES.length);
    }, 700);

    return () => {
      window.clearInterval(rotateTimer);
    };
  }, [prefersReducedMotion, showLoading]);

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
          transition={{ duration: 0.26, ease: 'easeOut' }}
        >
          <SmartStyleLoader mode="fullscreen" statusText={INTRO_MESSAGES[messageIndex]} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoadingScreen;
