/**
 * Enhanced Animated Button Component
 * Provides instant feedback with GPU-accelerated animations
 */
'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/lib/animation-config';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  loadingText?: string;
  haptic?: boolean;
  hapticPattern?: 'light' | 'medium' | 'heavy';
  className?: string;
  disabled?: boolean;
}

const sizeClasses = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
};

const variantClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
};

export const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      children,
      variant = 'default',
      size = 'default',
      loading = false,
      loadingText,
      haptic = false,
      hapticPattern = 'light',
      className,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const { triggerHaptic } = useHapticFeedback();
    const [isPressed, setIsPressed] = React.useState(false);

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        // Trigger haptic feedback on click if enabled
        if (haptic && !disabled && !loading) {
          triggerHaptic(hapticPattern);
        }

        // Call the original onClick handler
        if (onClick && !disabled && !loading) {
          onClick(event);
        }
      },
      [onClick, haptic, hapticPattern, triggerHaptic, disabled, loading]
    );

    const handleTouchStart = () => {
      setIsPressed(true);
    };

    const handleTouchEnd = () => {
      setIsPressed(false);
    };

    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'button-tap-effect',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={isDisabled}
        variants={buttonVariants}
        initial="initial"
        whileTap={!isDisabled ? 'tap' : undefined}
        whileHover={!isDisabled ? 'hover' : undefined}
        style={{
          willChange: !isDisabled ? 'transform' : undefined,
        }}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';
