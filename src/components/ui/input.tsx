import * as React from "react"

import { cn } from "@/lib/utils"
import { UI_DISABLED, UI_FOCUS_RING, UI_TRANSITION_FAST } from "@/lib/ui-tokens"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          `flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground ${UI_TRANSITION_FAST} ${UI_FOCUS_RING} disabled:cursor-not-allowed ${UI_DISABLED} md:text-sm`,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
