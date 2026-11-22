import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClass } from "@/lib/field-styles"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        fieldClass,
        "flex min-h-[80px] py-2.5",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
