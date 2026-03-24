'use client';

import { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedLogo from '@/components/AnimatedLogo';

/**
 * LoadingScreen - Netflix-inspired splash screen (2.8s total)
 * - Plays only once per browsers (uses localStorage "ss_loaded" key)
 * - 5-stage animation: logo intro → light sweep → ring spiral → text reveal → fade out
 */
export function LoadingScreen() {
  const [showLoading, setShowLoading] = useState(false);
  const maskId = useId();

  useEffect(() => {
    const isLoaded = localStorage.getItem('ss_loaded') === 'true';

    if (isLoaded) {
      return;
    }

    setShowLoading(true);

    // Stage 5 starts at 2.4s (fade out), unmount at 2.8s.
    const fadeTimer = window.setTimeout(() => {
      setShowLoading(false);
    }, 2400);

    const doneTimer = window.setTimeout(() => {
      localStorage.setItem('ss_loaded', 'true');
    }, 2800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {showLoading && (
        <motion.div
          key="loading-screen"
          className="fixed inset-0 flex items-center justify-center bg-black"
          style={{ zIndex: 9999 }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'linear' }}
        >
          <div className="flex flex-col items-center gap-9">
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <AnimatedLogo size={88} textSize={22} />

              {/* Stage 2: 0.4s–1.2s horizontal sweep clipped to SS letters only */}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={`${maskId}-sweep`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="35%" stopColor="#ffffff" stopOpacity="0.98" />
                    <stop offset="70%" stopColor="#c084fc" stopOpacity="0.92" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                  <mask id={`${maskId}-text-mask`}>
                    <rect x="0" y="0" width="100" height="100" fill="black" />
                    <text
                      x="50"
                      y="52"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontWeight="600"
                      letterSpacing="1.4"
                      fontSize="22"
                    >
                      SS
                    </text>
                  </mask>
                </defs>

                <motion.rect
                  x="-140"
                  y="41"
                  width="140"
                  height="20"
                  fill={`url(#${maskId}-sweep)`}
                  mask={`url(#${maskId}-text-mask)`}
                  animate={{ x: [-140, 100] }}
                  transition={{ duration: 0.8, delay: 0.4, ease: 'linear' }}
                />
              </svg>

              {/* Stage 3: 1.2s–1.8s concentric rings expand outward */}
              <motion.div
                className="pointer-events-none absolute inset-0"
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: [0, 1, 0], scale: [1, 1, 2.5], rotate: [0, 0, 36] }}
                transition={{ duration: 0.6, delay: 1.2, ease: 'easeOut', times: [0, 0.1, 1] }}
              >
                <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id={`${maskId}-burst-a`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#9333ea" />
                      <stop offset="65%" stopColor="#c084fc" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="28" fill="none" stroke={`url(#${maskId}-burst-a)`} strokeWidth="2.2" strokeDasharray="118 54" />
                  <circle cx="50" cy="50" r="36" fill="none" stroke={`url(#${maskId}-burst-a)`} strokeWidth="2" strokeDasharray="160 66" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${maskId}-burst-a)`} strokeWidth="1.6" strokeOpacity="0.3" />
                </svg>
              </motion.div>
            </motion.div>

            {/* Stage 4: 1.8s–2.4s SMARTSTYLE letters with stagger */}
            <motion.div
              className="flex gap-1"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    delayChildren: 1.8,
                    staggerChildren: 0.05,
                  },
                },
              }}
            >
              {'SMARTSTYLE'.split('').map((letter, index) => (
                <motion.span
                  key={`loading-letter-${index}`}
                  className="font-headline text-3xl font-semibold tracking-[0.08em] text-white"
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {letter}
                </motion.span>
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoadingScreen;
