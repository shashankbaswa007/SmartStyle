import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

export interface RippleFillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const RippleFillButton = React.forwardRef<HTMLButtonElement, RippleFillButtonProps>(
  ({ className, children, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(
          'group relative isolate inline-flex items-center justify-center overflow-hidden rounded-full border border-white/10 [&>*]:relative [&>*]:z-10',
          'bg-black/30 px-6 py-2.5 text-[15px] font-semibold tracking-wide text-purple-200',
          'transform-gpu transition-[transform,box-shadow,color,border-color] duration-300 ease-out',
          'hover:-translate-y-0.5 hover:text-white hover:shadow-[0_12px_40px_rgba(124,108,240,0.35)] hover:border-white/20',
          'active:scale-95 active:shadow-[0_6px_16px_rgba(124,108,240,0.2)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50',
          'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:z-[1] before:h-px before:bg-white/35 before:content-[""]',
          'after:pointer-events-none after:absolute after:left-1/2 after:top-1/2 after:z-0 after:h-12 after:w-12 after:-translate-x-1/2 after:-translate-y-1/2 after:scale-0 after:rounded-full after:bg-gradient-to-br after:from-purple-600 after:to-purple-500 after:opacity-0 after:transition-[transform,opacity] after:duration-500 after:ease-out group-hover:after:scale-[8] group-hover:after:opacity-100',
          'disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

RippleFillButton.displayName = 'RippleFillButton';

export { RippleFillButton };
