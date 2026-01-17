/**
 * Micro-Interactions Components
 * 
 * Hover effects, animations, and interactive elements
 */

"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Animated outfit card with hover effect
 */
interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedCard({ children, className, ...props }: AnimatedCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Color swatch with hover tooltip
 */
interface ColorSwatchProps {
  color: string;
  name?: string;
  size?: "sm" | "md" | "lg";
}

export function ColorSwatch({ color, name, size = "md" }: ColorSwatchProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <div className="relative inline-block">
      <motion.div
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        onHoverStart={() => setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
        className={cn(
          "rounded-full border-2 border-white shadow-lg cursor-pointer transition-all",
          sizeClasses[size]
        )}
        style={{ backgroundColor: color }}
      />

      {/* Tooltip */}
      {showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg whitespace-nowrap z-10 border"
        >
          {name && <div className="font-medium">{name}</div>}
          <div className="text-muted-foreground">{color}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
        </motion.div>
      )}
    </div>
  );
}

/**
 * Animated heart like button
 */
interface AnimatedHeartProps {
  isLiked: boolean;
  onToggle: () => void;
  size?: number;
}

export function AnimatedHeart({ isLiked, onToggle, size = 24 }: AnimatedHeartProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    onToggle();
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.8 }}
      className="relative focus:outline-none"
    >
      {/* Heart SVG */}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={isLiked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        className={cn(
          "transition-colors",
          isLiked ? "text-red-500" : "text-muted-foreground"
        )}
        animate={
          isAnimating
            ? {
                scale: [1, 1.3, 1],
                rotate: [0, -10, 10, 0],
              }
            : {}
        }
        transition={{ duration: 0.6 }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </motion.svg>

      {/* Particles effect when liking */}
      {isAnimating && isLiked && (
        <>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full"
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: Math.cos((i * 60 * Math.PI) / 180) * 20,
                y: Math.sin((i * 60 * Math.PI) / 180) * 20,
              }}
              transition={{ duration: 0.6 }}
            />
          ))}
        </>
      )}
    </motion.button>
  );
}

/**
 * Shopping link with loading state
 */
interface ShoppingLinkProps {
  href: string;
  platform: string;
  children: React.ReactNode;
  className?: string;
}

export function ShoppingLink({ href, platform, children, className }: ShoppingLinkProps) {
  const { toast } = useToast();
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpening(true);

    toast({
      title: "Opening...",
      description: `Redirecting to ${platform}`,
      duration: 2000,
    });

    setTimeout(() => {
      window.open(href, "_blank", "noopener,noreferrer");
      setIsOpening(false);
    }, 500);
  };

  return (
    <motion.a
      href={href}
      onClick={handleClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "inline-flex items-center gap-2 transition-all",
        isOpening && "opacity-50 cursor-wait",
        className
      )}
    >
      {children}
      <motion.div
        animate={isOpening ? { rotate: 360 } : {}}
        transition={{ duration: 1, repeat: isOpening ? Infinity : 0 }}
      >
        <ExternalLink className="w-4 h-4" />
      </motion.div>
    </motion.a>
  );
}

/**
 * Pulse animation for new features
 */
export function PulsingBadge({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="relative"
    >
      {children}
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
      </span>
    </motion.div>
  );
}

/**
 * Shake animation for errors
 */
export function ShakeAnimation({ children, trigger }: { children: React.ReactNode; trigger: boolean }) {
  return (
    <motion.div
      animate={
        trigger
          ? {
              x: [0, -10, 10, -10, 10, 0],
            }
          : {}
      }
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Float animation for illustrations
 */
export function FloatingElement({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Ripple effect button
 */
export function RippleButton({ 
  children, 
  onClick, 
  className 
}: { 
  children: React.ReactNode; 
  onClick?: () => void;
  className?: string;
}) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples([...ripples, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);

    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className={cn("relative overflow-hidden", className)}
    >
      {children}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
          initial={{ width: 0, height: 0, x: 0, y: 0 }}
          animate={{
            width: 200,
            height: 200,
            x: -100,
            y: -100,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      ))}
    </button>
  );
}
