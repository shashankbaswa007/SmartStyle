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
  const ringId = useId();
  const ringInnerId = useId();
  const highlightId = useId();
  const resolvedSize = size ?? sizeMap[variant];
  const resolvedDetail = detail === 'auto' ? (resolvedSize <= 22 ? 'minimal' : 'full') : detail;
  const showSecondaryRing = resolvedDetail === 'full';
  const primaryRingRadius = resolvedDetail === 'minimal' ? 22 : 23;
  const glyphFontSize = resolvedSize <= 22 ? 13 : 14.2;
  const glyphLetterSpacing = resolvedSize <= 22 ? '0.2px' : '0.28px';

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
        <radialGradient id={`${gradientId}-brand-core`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(22 18) rotate(52) scale(48)">
          <stop offset="0" stopColor="#1A2220" />
          <stop offset="0.58" stopColor={BRAND.colors.core} />
          <stop offset="1" stopColor={BRAND.colors.coreDeep} />
        </radialGradient>
        <radialGradient id={`${gradientId}-brand-aura`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 30) rotate(90) scale(30)">
          <stop offset="0" stopColor="rgba(27,154,141,0.15)" />
          <stop offset="0.7" stopColor="rgba(15,118,110,0.06)" />
          <stop offset="1" stopColor="rgba(15,118,110,0)" />
        </radialGradient>
        <linearGradient id={`${ringId}-brand-ring-primary`} x1="10" y1="50" x2="54" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(16,185,129,0.72)" />
          <stop offset="0.58" stopColor="rgba(20,184,166,0.52)" />
          <stop offset="1" stopColor="rgba(245,247,244,0.12)" />
        </linearGradient>
        <linearGradient id={`${ringInnerId}-brand-ring-secondary`} x1="54" y1="12" x2="14" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(245,247,244,0.22)" />
          <stop offset="0.54" stopColor="rgba(16,185,129,0.46)" />
          <stop offset="1" stopColor="rgba(20,184,166,0.14)" />
        </linearGradient>
        <linearGradient id={`${highlightId}-brand-edge`} x1="16" y1="14" x2="36" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(255,255,255,0.44)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r="30" fill={`url(#${gradientId}-brand-core)`} />
      <circle cx="32" cy="32" r="30" fill={`url(#${gradientId}-brand-aura)`} />
      <circle cx="32" cy="32" r="29.2" stroke="rgba(245,247,244,0.14)" strokeWidth="0.8" />

      <circle
        cx="32"
        cy="32"
        r={primaryRingRadius}
        stroke={`url(#${ringId}-brand-ring-primary)`}
        strokeWidth={resolvedDetail === 'minimal' ? 1.5 : 1.65}
        opacity={resolvedDetail === 'minimal' ? 0.64 : 0.74}
      />

      {showSecondaryRing ? (
        <circle
          cx="32"
          cy="32"
          r="17.2"
          stroke={`url(#${ringInnerId}-brand-ring-secondary)`}
          strokeWidth="1.6"
          opacity="0.62"
        />
      ) : null}

      {showSecondaryRing ? (
        <path d="M16.8 22.4C18.8 18.8 22.7 16.3 27.2 16.3" stroke={`url(#${highlightId}-brand-edge)`} strokeWidth="1" strokeLinecap="round" />
      ) : null}

      <text
        x="32"
        y="33.1"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(5,8,10,0.52)"
        fontFamily="Sora, Space Grotesk, Avenir Next, sans-serif"
        fontSize={glyphFontSize}
        fontWeight="600"
        letterSpacing={glyphLetterSpacing}
      >
        SS
      </text>
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={BRAND.colors.frost}
        fontFamily="Sora, Space Grotesk, Avenir Next, sans-serif"
        fontSize={glyphFontSize}
        fontWeight="600"
        letterSpacing={glyphLetterSpacing}
      >
        SS
      </text>
    </svg>
  );
}
