/**
 * Animated Toast Component
 * Smooth slide animations with bounce effect
 */
'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toastVariants } from '@/lib/animation-config';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface AnimatedToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
  icon?: React.ReactNode;
}

const iconMap = {
  success: <CheckCircle2 className="text-green-500" size={20} />,
  error: <AlertCircle className="text-red-500" size={20} />,
  info: <Info className="text-blue-500" size={20} />,
  loading: <Loader2 className="text-primary animate-spin" size={20} />,
};

export const AnimatedToast: React.FC<AnimatedToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  icon,
}) => {
  React.useEffect(() => {
    if (duration > 0 && type !== 'loading') {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, type, onClose]);

  return (
    <motion.div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-50',
        'bg-card border border-border rounded-lg shadow-lg',
        'px-4 py-3 min-w-[300px] max-w-md',
        'flex items-center gap-3'
      )}
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {icon || iconMap[type]}
      </div>

      {/* Message */}
      <div className="flex-1 text-sm font-medium text-foreground">
        {message}
      </div>

      {/* Close button */}
      {type !== 'loading' && (
        <button
          onClick={onClose}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </motion.div>
  );
};

/**
 * Toast Manager Hook
 */
interface Toast extends AnimatedToastProps {
  id: string;
}

export const useAnimatedToast = () => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const showToast = React.useCallback(
    (props: Omit<AnimatedToastProps, 'onClose'>) => {
      const id = Math.random().toString(36).substring(7);
      const toast: Toast = {
        ...props,
        id,
      };
      setToasts((prev) => [...prev, toast]);
      return id;
    },
    []
  );

  const hideToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const ToastContainer = React.useCallback(
    () => (
      <AnimatePresence>
        {toasts.map((toast) => (
          <AnimatedToast
            key={toast.id}
            {...toast}
            onClose={() => hideToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    ),
    [toasts, hideToast]
  );

  return { showToast, hideToast, ToastContainer };
};
