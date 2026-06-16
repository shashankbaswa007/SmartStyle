'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import AnimatedLogo from '@/components/AnimatedLogo';
import { cn } from '@/lib/utils';
import { useMotionSettings } from '@/components/MotionProvider';

type LoaderMode = 'fullscreen' | 'operation';

interface SmartStyleLoaderProps {
  statusText?: string;
  mode?: LoaderMode;
  stage?: number;
  premium?: boolean;
  className?: string;
}

const WORDMARK = 'SMARTSTYLE';

function StageIndicators({ stage = 0 }: { stage?: number }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2" aria-hidden="true">
      {[0, 1, 2].map((dotStage) => {
        const active = dotStage <= stage;

        return (
          <span
            key={dotStage}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              active ? 'w-6 bg-emerald-300' : 'w-2 bg-emerald-400/35'
            )}
          />
        );
      })}
    </div>
  );
}

export default function SmartStyleLoader({
  statusText = 'Preparing your style experience...',
  mode = 'operation',
  stage = 0,
  premium = false,
  className,
}: SmartStyleLoaderProps) {
  const { prefersReducedMotion } = useMotionSettings();
  const isFullscreen = mode === 'fullscreen';
  const premiumVisuals = premium || isFullscreen;
  const premiumMotionEnabled = premiumVisuals && !prefersReducedMotion;
  const logoSize = isFullscreen ? 84 : 62;

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden',
        isFullscreen
          ? 'flex h-full w-full items-center justify-center bg-[#060d0b] px-6'
          : 'rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-[#10201c] via-[#0b1512] to-[#08100d] p-6 sm:p-8',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 18%, rgba(16, 185, 129, 0.18), transparent 36%), radial-gradient(circle at 82% 14%, rgba(13, 148, 136, 0.16), transparent 42%), radial-gradient(circle at 50% 85%, rgba(111, 100, 136, 0.08), transparent 48%)',
        }}
      />

      {premiumMotionEnabled && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.04, 0.24, 0.08] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(ellipse 640px 320px at 50% 28%, rgba(209, 250, 229, 0.2), transparent 72%)',
          }}
        />
      )}

      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-[-45%] w-[45%]"
          animate={{ x: ['0%', '255%'] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: 'linear' }}
          style={{
            background:
              'linear-gradient(110deg, transparent 10%, rgba(204, 251, 241, 0.18) 44%, rgba(45, 212, 191, 0.16) 56%, transparent 88%)',
            filter: 'blur(16px)',
            opacity: isFullscreen ? 0.72 : 0.54,
          }}
        />
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="relative flex items-center justify-center">
          {!prefersReducedMotion && (
            <>
              <motion.div
                aria-hidden="true"
                className="absolute h-[6.4rem] w-[6.4rem] rounded-full border border-emerald-300/35"
                animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                aria-hidden="true"
                className="absolute h-[8rem] w-[8rem] rounded-full"
                animate={{ scale: [0.94, 1.1, 0.94], opacity: [0.15, 0.34, 0.15] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
                style={{ boxShadow: '0 0 42px rgba(16, 185, 129, 0.42)' }}
              />
              <motion.div
                aria-hidden="true"
                className="absolute h-[7.2rem] w-[7.2rem] rounded-full border border-emerald-200/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
              />
              {premiumMotionEnabled && (
                <motion.div
                  aria-hidden="true"
                  className="absolute h-[6.7rem] w-[6.7rem] rounded-full"
                  animate={{
                    boxShadow: [
                      '0 0 0 rgba(111, 100, 136, 0.12)',
                      '0 0 30px rgba(16, 185, 129, 0.38)',
                      '0 0 0 rgba(111, 100, 136, 0.12)',
                    ],
                    scale: [0.96, 1.04, 0.96],
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </>
          )}

          <motion.div
            initial={
              premiumMotionEnabled
                ? { opacity: 0, scale: 0.9, y: 8, filter: 'blur(12px)' }
                : { opacity: 0, scale: 0.92, y: 8 }
            }
            animate={
              premiumMotionEnabled
                ? { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }
                : { opacity: 1, scale: 1, y: 0 }
            }
            transition={{ duration: premiumMotionEnabled ? 0.58 : 0.42, ease: 'easeOut' }}
          >
            <AnimatedLogo size={logoSize} />
          </motion.div>
        </div>

        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-x-0.5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.035,
              },
            },
          }}
        >
          {WORDMARK.split('').map((letter, index) => (
            <motion.span
              key={`${letter}-${index}`}
              className={cn(
                'font-headline font-semibold tracking-[0.14em] text-emerald-100',
                isFullscreen ? 'text-[1.06rem]' : 'text-[0.92rem] sm:text-[1rem]'
              )}
              variants={{
                hidden: { opacity: 0, y: 6 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {letter}
            </motion.span>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'mt-3 max-w-sm text-center text-sm text-emerald-100/85',
              isFullscreen ? 'text-base sm:text-lg' : 'text-sm'
            )}
          >
            {statusText}
          </motion.p>
        </AnimatePresence>

        {!isFullscreen && <StageIndicators stage={stage} />}
      </div>
    </div>
  );
}
