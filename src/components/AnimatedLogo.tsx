'use client';

import { motion } from 'framer-motion';

interface AnimatedLogoProps {
  size?: number;
  textSize?: number;
  className?: string;
}

export default function AnimatedLogo({ size = 48, textSize, className = '' }: AnimatedLogoProps) {
  void textSize;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label="SmartStyle logo"
    >
      <motion.img
        src="/icons/brand-icon.svg"
        alt="SmartStyle"
        className="h-full w-full"
        draggable={false}
        animate={{ scale: [1, 1.015, 1] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
      />
    </div>
  );
}