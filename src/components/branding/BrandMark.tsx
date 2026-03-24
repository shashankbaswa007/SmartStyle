import { useId } from 'react';
import { BRAND } from '@/lib/branding';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  size?: number;
  variant?: 'tiny' | 'small' | 'default' | 'hero';
  detail?: 'auto' | 'minimal' | 'full';
  className?: string;
};

const sizeMap = {
  tiny: BRAND.logo.size.tiny,
  small: BRAND.logo.size.small,
  default: BRAND.logo.size.medium,
  hero: BRAND.logo.size.large,
} as const;

export function BrandMark({
  size,
  variant = 'default',
  detail = 'auto',
  className,
}: BrandMarkProps) {
  const gradientId = useId();
  const highlightId = useId();
  const resolvedSize = size ?? sizeMap[variant];
  const resolvedDetail = detail === 'auto' ? (resolvedSize <= 22 ? 'minimal' : 'full') : detail;

  return (
    <svg
      viewBox="0 0 64 64"
      width={resolvedSize}
      height={resolvedSize}
      aria-hidden="true"
      className={cn('shrink-0', className)}
      role="img"
    >
      <defs>
        <linearGradient id={`${gradientId}-brand-core`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND.colors.accent} />
          <stop offset="0.5" stopColor={BRAND.colors.core} />
          <stop offset="1" stopColor={BRAND.colors.glow} />
        </linearGradient>
        <linearGradient id={`${highlightId}-brand-needle`} x1="40" y1="6" x2="60" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND.colors.frost} />
          <stop offset="1" stopColor={BRAND.colors.mist} />
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#${gradientId}-brand-core)`} />
      <rect x="4" y="4" width="56" height="56" rx="18" fill="rgba(3, 7, 18, 0.16)" />

      <path
        d="M43 16.8 31.3 35.8a2.5 2.5 0 0 1-3.9.2l-5.1-6.5a2.2 2.2 0 1 0-3.4 2.8l7.1 8.9a6.6 6.6 0 0 0 10.8-.6l10-16.8a2.2 2.2 0 0 0-3.8-2.4Z"
        fill="rgba(8, 12, 28, 0.65)"
      />

      {resolvedDetail === 'full' ? (
        <path
          d="M39.9 11.7 54.1 10a1.5 1.5 0 0 1 1.6 2.2L48.8 26a1.5 1.5 0 0 1-2.8-.3l-1.7-6a1.5 1.5 0 0 0-1.1-1.1l-5.8-1.6a1.5 1.5 0 0 1-.3-2.9Z"
          fill={`url(#${highlightId}-brand-needle)`}
        />
      ) : null}

      {resolvedDetail === 'full' ? (
        <path
          d="M34.4 43.2c0 4.3-3.9 7.7-8.7 7.7-4.8 0-8.7-3.4-8.7-7.7 0-2.5 1.4-4.7 3.5-6.2 1.8 2.8 4.8 4.6 8.3 4.6 2 0 3.9-.7 5.6-1.8Z"
          fill="rgba(15, 23, 42, 0.45)"
        />
      ) : (
        <circle cx="49" cy="15" r="3" fill={BRAND.colors.frost} opacity="0.85" />
      )}
    </svg>
  );
}
