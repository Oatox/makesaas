import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // bg-secondary, not bg-muted: muted is the card/page colour, which made skeletons invisible.
      className={cn("animate-pulse rounded-md bg-secondary", className)}
      {...props}
    />
  )
}

export { Skeleton }
