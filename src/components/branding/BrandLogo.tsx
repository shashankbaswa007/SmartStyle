import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/branding';
import { BrandMark } from './BrandMark';

type BrandLogoVariant = 'full' | 'compact' | 'mark-only';
type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  accentClassName?: string;
  size?: number;
  sizePreset?: BrandLogoSize;
  variant?: BrandLogoVariant;
  showTagline?: boolean;
};

const markSizes: Record<BrandLogoSize, number> = {
  xs: BRAND.logo.size.tiny,
  sm: BRAND.logo.size.small,
  md: BRAND.logo.size.medium,
  lg: BRAND.logo.size.large,
  xl: BRAND.logo.size.hero,
};

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  accentClassName,
  size,
  sizePreset = 'md',
  variant = 'full',
  showTagline = false,
}: BrandLogoProps) {
  const resolvedSize = size ?? markSizes[sizePreset];
  const showWordmark = variant !== 'mark-only';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark
        size={resolvedSize}
        detail={variant === 'compact' ? 'minimal' : 'auto'}
        className={markClassName}
      />
      {showWordmark ? (
        <div className="min-w-0 leading-none">
            <p
              className={cn(
                'font-headline text-lg font-semibold text-foreground',
                variant === 'compact' && 'text-base tracking-tight',
                textClassName
              )}
              style={{ letterSpacing: BRAND.logo.wordmark.letterSpacing }}
            >
              {variant === 'compact' ? (
                'SS'
              ) : (
                <>
                  <span className="text-foreground">Smart</span>
                  <span
                    className={cn('text-emerald-300/95', accentClassName)}
                    style={{ letterSpacing: BRAND.logo.wordmark.accentLetterSpacing }}
                  >
                    Style
                  </span>
                </>
              )}
            </p>
          {showTagline ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              {BRAND.tagline}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
