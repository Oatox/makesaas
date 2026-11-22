import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClass } from "@/lib/field-styles"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClass,
          "flex h-11 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:h-10",
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
