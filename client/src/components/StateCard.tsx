import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** "large": page-level placeholder (bigger orange icon and heading), e.g. an empty history. */
  size?: "default" | "large";
  className?: string;
};

/** Centered card for an empty list or a missing resource. */
export function EmptyState({ icon: Icon, title, description, action, size = "default", className }: EmptyStateProps) {
  const large = size === "large";

  return (
    <div className={cn("card-3d flex flex-col items-center gap-3 text-center", large ? "px-6 py-12 sm:py-16" : "p-8", className)}>
      <Icon
        aria-hidden
        className={large ? "size-12 text-primary" : "size-8 text-muted-foreground"}
        strokeWidth={large ? 1.75 : undefined}
      />
      {large ? (
        <h2 className="mt-2 font-display text-xl font-light sm:text-2xl">{title}</h2>
      ) : (
        <p className="font-medium">{title}</p>
      )}
      {description && <p className={cn("max-w-sm text-muted-foreground", !large && "text-sm")}>{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

type ErrorStateProps = {
  /** Without a title, the message itself is shown in red. */
  title?: ReactNode;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Red card for a failed load. */
export function ErrorState({ title, message, action, className }: ErrorStateProps) {
  return (
    <div className={cn("card-3d card-3d-danger p-5 text-sm", !title && "text-destructive", className)} role="alert">
      {title ? (
        <>
          <p className="font-semibold text-destructive">{title}</p>
          <p className="mt-1 text-muted-foreground">{message}</p>
        </>
      ) : (
        message
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
