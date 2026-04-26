'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PremiumAuthLoader } from '@/components/auth/PremiumAuthLoader';
import { BRAND, INTRO_REPLAY_QUERY, INTRO_STORAGE_KEY } from '@/lib/branding';
import { MOTION_DURATION } from '@/lib/premium-motion';
import { useMotionSettings } from '@/components/MotionProvider';

type LogoIntroProps = {
  onFinish?: () => void;
};

const INTRO_REPLAY_EVENT = 'smartstyle:replay-intro';

export function LogoIntro({ onFinish }: LogoIntroProps) {
  const [phase, setPhase] = useState<'checking' | 'open' | 'closed'>('checking');
  const [mounted, setMounted] = useState(false);
  const { prefersReducedMotion, duration } = useMotionSettings();
  const open = phase === 'open';

  const introDurationMs = useMemo(
    () => (prefersReducedMotion ? BRAND.motion.introReducedMs : BRAND.motion.introMs),
    [prefersReducedMotion]
  );

  useEffect(() => {
    setMounted(true);

    let shouldReplay = false;
    let seen = false;

    try {
      const url = new URL(window.location.href);
      shouldReplay = url.searchParams.get(INTRO_REPLAY_QUERY) === '1';
      seen = sessionStorage.getItem(INTRO_STORAGE_KEY) === '1';

      if (shouldReplay) {
        url.searchParams.delete(INTRO_REPLAY_QUERY);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      setPhase('open');
      return;
    }

    if (shouldReplay || !seen) {
      setPhase('open');
      return;
    }

    setPhase('closed');
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const startedAt = performance.now();
    const minShowMs = prefersReducedMotion ? 260 : 1400;
    let closed = false;

    const closeIntro = () => {
      if (closed) {
        return;
      }

      closed = true;
      try {
        sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
      } catch {
        // Best effort: if storage is unavailable, still close the intro.
      }
      setPhase('closed');
      onFinish?.();
    };

    const closeWhenReady = () => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, minShowMs - elapsed);
      window.setTimeout(closeIntro, remaining);
    };

    const hardTimer = window.setTimeout(closeIntro, introDurationMs);

    if (document.readyState === 'complete') {
      closeWhenReady();
    } else {
      window.addEventListener('load', closeWhenReady, { once: true });
    }

    return () => {
      window.clearTimeout(hardTimer);
      window.removeEventListener('load', closeWhenReady);
    };
  }, [open, introDurationMs, onFinish, prefersReducedMotion]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const handler = () => {
      setPhase('open');
    };

    window.addEventListener(INTRO_REPLAY_EVENT, handler);
    return () => window.removeEventListener(INTRO_REPLAY_EVENT, handler);
  }, []);

  if (!mounted) {
    return null;
  }

  if (phase === 'checking') {
    return <div className="fixed inset-0 z-[120] bg-[#050D0A]" aria-hidden="true" />;
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: duration(MOTION_DURATION.normal, 'primary') } }}
          className="fixed inset-0 z-[120] overflow-hidden bg-[#050D0A]"
          aria-label="SmartStyle intro"
          role="status"
        >
          <PremiumAuthLoader statusText="Composing your style atmosphere" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
