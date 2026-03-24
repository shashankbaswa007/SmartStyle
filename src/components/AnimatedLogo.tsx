'use client';

import { motion } from 'framer-motion';

interface AnimatedLogoProps {
  size?: number;
  textSize?: number;
  className?: string;
}

export default function AnimatedLogo({ size = 48, textSize, className = '' }: AnimatedLogoProps) {
  const resolvedTextSize = textSize ?? Math.max(14, Math.round(size * 0.34));

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label="SmartStyle logo"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ss-ring-inner" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="65%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="ss-ring-middle" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="65%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="ss-ring-outer" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="65%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <motion.g
          animate={{ rotate: [0, 360] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          style={{ transformOrigin: '50px 50px' }}
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#ss-ring-outer)"
            strokeWidth="1.8"
            strokeOpacity="0.28"
          />
        </motion.g>

        <motion.g
          animate={{ rotate: [360, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
          style={{ transformOrigin: '50px 50px' }}
        >
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="url(#ss-ring-middle)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="160 66"
          />
        </motion.g>

        <motion.g
          animate={{ rotate: [0, 360] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
          style={{ transformOrigin: '50px 50px' }}
        >
          <circle
            cx="50"
            cy="50"
            r="28"
            fill="none"
            stroke="url(#ss-ring-inner)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="118 54"
          />
        </motion.g>

        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontWeight="600"
          letterSpacing="1.4"
          style={{ fontSize: `${resolvedTextSize}px` }}
        >
          SS
        </text>
      </svg>
    </div>
  );
}