'use client';

import { motion } from 'framer-motion';
import DarkVeil from '@/components/DarkVeil';
import AnimatedLogo from '@/components/AnimatedLogo';
import { AUTH_ANIMATION_CONFIG } from '@/lib/auth-branding';
import { MOTION_EASING } from '@/lib/premium-motion';
import { useMotionSettings } from '@/components/MotionProvider';

interface PremiumAuthLoaderProps {
  statusText?: string;
  premium?: boolean;
}

export function PremiumAuthLoader({
  statusText = 'Composing your style atmosphere',
  premium = true,
}: PremiumAuthLoaderProps) {
  const { prefersReducedMotion } = useMotionSettings();

  if (prefersReducedMotion || !premium) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050813]">
        <div className="absolute inset-0">
          <DarkVeil
            hueShift={9}
            noiseIntensity={0.012}
            scanlineIntensity={0.02}
            speed={0.26}
            scanlineFrequency={0.001}
            warpAmount={0.03}
            resolutionScale={0.8}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_82%_22%,rgba(99,102,241,0.2),transparent_42%),linear-gradient(140deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.9)_100%)',
          }}
        />

        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-[1.9rem] border border-white/14 bg-slate-950/60 p-8 shadow-[0_30px_70px_rgba(5,10,26,0.58)] backdrop-blur-2xl">
            <div className="flex justify-center">
              <AnimatedLogo size={58} />
            </div>
            <p className="mt-6 text-center text-[11px] uppercase tracking-[0.15em] text-slate-300/72">{statusText}</p>
          </div>
        </div>
      </div>
    );
  }

  const stages = AUTH_ANIMATION_CONFIG.premiumLoadingStages;
  const markOnlyWidth = 58;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050813]">
      <div className="absolute inset-0">
        <DarkVeil
          hueShift={9}
          noiseIntensity={0.014}
          scanlineIntensity={0.02}
          speed={0.28}
          scanlineFrequency={0.001}
          warpAmount={0.03}
          resolutionScale={0.8}
        />
      </div>

      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: stages.atmosphereFadeIn.end, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(circle_at_14%_20%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_86%_20%,rgba(99,102,241,0.24),transparent_44%),radial-gradient(circle_at_50%_85%,rgba(14,165,233,0.08),transparent_42%),linear-gradient(140deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.9)_100%)',
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.72, 0.08] }}
        transition={{
          duration: stages.contourLight.end - stages.contourLight.start,
          delay: stages.contourLight.start,
          ease: 'easeInOut',
          times: [0, 0.52, 1],
        }}
        style={{
          background:
            'radial-gradient(ellipse 680px 440px at 50% 30%, rgba(186,230,253,0.18) 0%, rgba(56,189,248,0.12) 28%, transparent 74%)',
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[-20%] w-[60%]"
        initial={{ opacity: 0, x: '-30%' }}
        animate={{ opacity: [0, 0.26, 0], x: ['-30%', '85%', '140%'] }}
        transition={{
          duration: 3,
          delay: 1.45,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          background:
            'linear-gradient(100deg, transparent 15%, rgba(226,232,240,0.2) 48%, rgba(125,211,252,0.16) 58%, transparent 84%)',
          filter: 'blur(14px)',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.975 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="relative w-full max-w-sm rounded-[1.9rem] border border-white/14 bg-slate-950/60 p-8 shadow-[0_32px_76px_rgba(5,10,26,0.62)] backdrop-blur-2xl"
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 rounded-[1.5rem]"
            animate={{
              boxShadow: [
                '0 0 0 rgba(125,211,252,0.16)',
                '0 0 38px rgba(125,211,252,0.38)',
                '0 0 0 rgba(125,211,252,0.16)',
              ],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <div className="flex justify-center">
            <motion.div
              className="overflow-hidden"
              initial={{ width: markOnlyWidth, opacity: 0, filter: 'blur(14px)', y: 6 }}
              animate={{ width: '100%', opacity: 1, filter: 'blur(0px)', y: 0 }}
              transition={{
                width: {
                  duration: stages.wordmarkEntrance.end - stages.markReveal.start,
                  delay: stages.markReveal.start,
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: {
                  duration: stages.markReveal.end - stages.markReveal.start,
                  delay: stages.markReveal.start,
                  ease: [0.22, 1, 0.36, 1],
                },
                filter: {
                  duration: stages.markReveal.end - stages.markReveal.start,
                  delay: stages.markReveal.start,
                  ease: MOTION_EASING.graceful,
                },
                y: {
                  duration: stages.markReveal.end - stages.markReveal.start,
                  delay: stages.markReveal.start,
                  ease: MOTION_EASING.graceful,
                },
              }}
            >
              <div className="flex justify-center">
                <AnimatedLogo size={58} />
              </div>
            </motion.div>
          </div>

          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[1.9rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.28, 0.14] }}
            transition={{
              duration: stages.breathingPulse.end - stages.breathingPulse.start,
              delay: stages.breathingPulse.start,
              ease: 'easeInOut',
            }}
            style={{
              boxShadow: 'inset 0 0 42px rgba(56,189,248,0.16), 0 0 68px rgba(56,189,248,0.12)',
            }}
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: stages.wordmarkEntrance.start + 0.24, duration: 0.55 }}
            className="mt-6 text-center text-[11px] uppercase tracking-[0.15em] text-slate-300/72"
          >
            {statusText}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

export default PremiumAuthLoader;
