import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Classes shared by every 3D (solid) variant
const solid3d = "btn-3d text-white font-semibold border border-transparent"

const buttonVariants = cva(
  "inline-flex max-w-full items-center justify-center gap-2 whitespace-normal break-words rounded-[10px] text-center text-sm font-medium leading-snug focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        // Brand 3D push buttons: shared shape/motion in .btn-3d, color per .btn-3d-* (index.css)
        default: `${solid3d} btn-3d-primary`,
        destructive: `${solid3d} btn-3d-destructive`,
        outline:
          "border border-border shadow-xs active:shadow-none",
        secondary: `${solid3d} btn-3d-secondary`,
        ghost: "border border-transparent",
      },
      // Heights are set as "min" heights, because sometimes Ai will place large amount of content
      // inside buttons. With a min-height they will look appropriate with small amounts of content,
      // but will expand to fit large amounts of content.
      size: {
        default: "min-h-11 px-4 py-2.5 sm:min-h-9 sm:py-2",
        // Visually compact, but an invisible 44px-high hit area keeps it easy to tap on touch screens.
        sm: "relative min-h-8 px-3 py-1.5 text-xs after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] sm:after:hidden",
        lg: "min-h-12 px-8 py-3 sm:min-h-10 sm:py-2.5",
        icon: "h-11 w-11 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
