'use client';

import { motion } from 'framer-motion';

import { useMotionSettings } from '@/components/MotionProvider';
import { BRAND } from '@/lib/branding';

const WORDMARK = Array.from(BRAND.name);
const RIPPLE_LAYERS = [
  { delay: 0, size: 'clamp(7.4rem, 25vw, 10.8rem)', border: 'rgba(110, 231, 183, 0.34)', glow: 'rgba(16, 185, 129, 0.22)' },
  { delay: 0.85, size: 'clamp(8.3rem, 29vw, 12.2rem)', border: 'rgba(153, 246, 228, 0.28)', glow: 'rgba(20, 184, 166, 0.2)' },
  { delay: 1.7, size: 'clamp(9.1rem, 32vw, 13.5rem)', border: 'rgba(209, 250, 229, 0.2)', glow: 'rgba(15, 118, 110, 0.16)' },
  { delay: 2.55, size: 'clamp(10rem, 36vw, 14.8rem)', border: 'rgba(20, 184, 166, 0.1)', glow: 'rgba(15, 118, 110, 0.13)' },
];

export function AppEntryLoader() {
  const { prefersReducedMotion } = useMotionSettings();

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#050D0A] px-6"
      role="status"
      aria-label="SmartStyle is loading"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 16% 18%, rgba(16, 185, 129, 0.18), transparent 36%), radial-gradient(circle at 84% 14%, rgba(20, 184, 166, 0.14), transparent 42%), radial-gradient(ellipse 68% 52% at 50% 86%, rgba(15, 118, 110, 0.22), transparent 76%), linear-gradient(160deg, #040607 0%, #08110F 46%, #030405 100%)',
        }}
      />

      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0.18 }}
          animate={{ opacity: [0.14, 0.34, 0.16], scale: [0.985, 1.015, 0.99] }}
          transition={{ duration: 8.2, repeat: Infinity, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            background:
              'radial-gradient(ellipse 680px 410px at 50% 30%, rgba(236, 253, 245, 0.2), rgba(16, 185, 129, 0.08) 42%, transparent 78%)',
          }}
        />
      )}

      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-[-42%] w-[44%]"
          animate={{ x: ['0%', '264%'], opacity: [0, 0.22, 0.08, 0] }}
          transition={{ duration: 8.8, repeat: Infinity, ease: 'linear' }}
          style={{
            background:
              'linear-gradient(110deg, transparent 12%, rgba(236, 253, 245, 0.2) 44%, rgba(153, 246, 228, 0.18) 58%, transparent 88%)',
            filter: 'blur(14px)',
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          {!prefersReducedMotion &&
            RIPPLE_LAYERS.map((layer) => (
              <motion.span
                key={`ripple-${layer.delay}`}
                aria-hidden="true"
                className="absolute rounded-full"
                style={{
                  width: layer.size,
                  height: layer.size,
                  border: `1px solid ${layer.border}`,
                  background:
                    'radial-gradient(circle, rgba(236, 253, 245, 0.16) 0%, rgba(153, 246, 228, 0.08) 38%, rgba(16, 185, 129, 0.02) 62%, transparent 74%)',
                  boxShadow: `0 0 28px ${layer.glow}`,
                  filter: 'blur(0.4px)',
                  willChange: 'transform, opacity',
                }}
                initial={{ scale: 0.68, opacity: 0 }}
                animate={{ scale: [0.72, 1.22, 1.88], opacity: [0.44, 0.22, 0] }}
                transition={{
                  duration: 5.2,
                  repeat: Infinity,
                  delay: layer.delay,
                  ease: [0.12, 0.92, 0.32, 1],
                  times: [0, 0.58, 1],
                }}
              />
            ))}

          {!prefersReducedMotion && (
            <motion.span
              aria-hidden="true"
              className="absolute rounded-full"
              style={{
                width: 'clamp(5.8rem, 19vw, 8.2rem)',
                height: 'clamp(5.8rem, 19vw, 8.2rem)',
                background:
                  'radial-gradient(circle, rgba(236, 253, 245, 0.28) 0%, rgba(153, 246, 228, 0.18) 42%, rgba(15, 118, 110, 0.05) 68%, transparent 80%)',
                filter: 'blur(6px)',
                willChange: 'transform, opacity',
              }}
              animate={{ opacity: [0.32, 0.68, 0.32], scale: [0.94, 1.08, 0.94] }}
              transition={{ duration: 6.2, repeat: Infinity, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          )}

          <motion.div
            className="relative flex items-center justify-center rounded-full border border-emerald-100/24 bg-white/[0.03] p-4 backdrop-blur-xl"
            style={{
              width: 'clamp(4.9rem, 16vw, 7.2rem)',
              height: 'clamp(4.9rem, 16vw, 7.2rem)',
              boxShadow: prefersReducedMotion
                ? '0 0 0 1px rgba(209, 250, 229, 0.18)'
                : '0 0 38px rgba(16, 185, 129, 0.28), inset 0 0 28px rgba(153, 246, 228, 0.14)',
              background:
                'radial-gradient(circle at 34% 26%, rgba(236, 253, 245, 0.32), rgba(153, 246, 228, 0.18) 36%, rgba(10, 14, 13, 0.34) 78%)',
              willChange: 'transform, opacity',
            }}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.24 : 0.95, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              className="flex h-full w-full items-center justify-center rounded-full"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: [1, 1.028, 1],
                      boxShadow: [
                        '0 0 18px rgba(153, 246, 228, 0.18)',
                        '0 0 36px rgba(16, 185, 129, 0.34)',
                        '0 0 18px rgba(153, 246, 228, 0.18)',
                      ],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: 5.6,
                      repeat: Infinity,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }
              }
              style={{ willChange: 'transform, box-shadow' }}
            >
              <motion.img
                src="/icons/brand-icon.svg"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="h-[clamp(2.8rem,9vw,4.1rem)] w-[clamp(2.8rem,9vw,4.1rem)]"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        scale: [0.992, 1.04, 0.992],
                        rotate: [0, 0.45, 0],
                      }
                }
                transition={
                  prefersReducedMotion
                    ? undefined
                    : {
                        duration: 5.2,
                        repeat: Infinity,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }
                }
                style={{ willChange: 'transform' }}
              />
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          className="mt-8 flex items-center justify-center"
          initial="hidden"
          animate="visible"
          variants={
            prefersReducedMotion
              ? {
                  hidden: { opacity: 0 },
                  visible: { opacity: 1 },
                }
              : {
                  hidden: {},
                  visible: {
                    transition: {
                      delayChildren: 0.62,
                      staggerChildren: 0.14,
                    },
                  },
                }
          }
        >
          {WORDMARK.map((letter, index) => (
            <motion.span
              key={`wordmark-${index}`}
              className="font-entry-premium text-[clamp(1.78rem,7.6vw,2.58rem)] font-semibold tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-50 via-teal-100 to-slate-100"
              variants={
                prefersReducedMotion
                  ? {
                      hidden: { opacity: 0 },
                      visible: { opacity: 1 },
                    }
                  : {
                      hidden: { opacity: 0, y: 14, filter: 'blur(10px)' },
                      visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
                    }
              }
              transition={{
                duration: prefersReducedMotion ? 0.24 : 0.76,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              {letter}
            </motion.span>
          ))}
        </motion.div>

        {!prefersReducedMotion && (
          <motion.p
            className="mt-2 text-[0.72rem] uppercase tracking-[0.22em] text-emerald-100/68"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.95, duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            Tailored by intelligence
          </motion.p>
        )}
      </div>
    </div>
  );
}

export default AppEntryLoader;
