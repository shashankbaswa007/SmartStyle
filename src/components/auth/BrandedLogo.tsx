'use client';

import { motion } from 'framer-motion';
import { AUTH_LOGO_CONFIG, AUTH_LOGO_LOCKUP, AUTH_LOGO_MOTION } from '@/lib/auth-branding';
import { useMotionSettings } from '@/components/MotionProvider';

interface BrandedLogoProps {
  animatedRings?: boolean;
  showMark?: boolean;
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
}

/**
 * BrandedLogo - Single logo lockup shared across auth contexts.
 */
export function BrandedLogo({
  animatedRings = true,
  showMark = true,
  showWordmark = true,
  showTagline = false,
  className = '',
}: BrandedLogoProps) {
  useMotionSettings();
  const shouldAnimate = animatedRings;

  return (
    <div className={`mx-auto inline-flex items-center ${AUTH_LOGO_LOCKUP.gap} ${className}`}>
      {showMark ? (
        <div className={AUTH_LOGO_LOCKUP.markRoot}>
          {shouldAnimate ? (
            <motion.div
              aria-hidden="true"
              className={AUTH_LOGO_LOCKUP.outerRing}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: AUTH_LOGO_MOTION.outerDuration, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <div aria-hidden="true" className={AUTH_LOGO_LOCKUP.outerRing} />
          )}

          {shouldAnimate ? (
            <motion.div
              aria-hidden="true"
              className={AUTH_LOGO_LOCKUP.middleRing}
              animate={{ rotate: [360, 0] }}
              transition={{ duration: AUTH_LOGO_MOTION.middleDuration, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <div aria-hidden="true" className={AUTH_LOGO_LOCKUP.middleRing} />
          )}

          {shouldAnimate ? (
            <motion.div
              aria-hidden="true"
              className={AUTH_LOGO_LOCKUP.innerRing}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: AUTH_LOGO_MOTION.innerDuration, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <div aria-hidden="true" className={AUTH_LOGO_LOCKUP.innerRing} />
          )}

          <div className={AUTH_LOGO_LOCKUP.center}>
            <span className={AUTH_LOGO_LOCKUP.glyph}>
              {AUTH_LOGO_CONFIG.glyph.letter}
            </span>
          </div>
        </div>
      ) : null}

      {showWordmark ? (
        <div className="text-left">
          <p className={AUTH_LOGO_LOCKUP.wordmark}>{AUTH_LOGO_CONFIG.wordmark.text}</p>
          {showTagline ? <p className={AUTH_LOGO_LOCKUP.tagline}>{AUTH_LOGO_CONFIG.taglines.primary}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export default BrandedLogo;
