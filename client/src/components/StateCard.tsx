import type { ComponentType, CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { blurIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

type EmptyStateProps = {
  /** A lucide icon or a brand logo (react-icons). */
  icon: ComponentType<{ className?: string }>;
  /** Large size only: drawn instead of the icon's orange tile (e.g. brand logos, as in ConnectFirst). */
  visual?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * "large": a page's empty state, in the style of the revenue dashboard's call to connect
   * (ConnectFirst): the icon on a raised orange tile, a display title, a short description.
   */
  size?: "default" | "large";
  className?: string;
};

// Same tile as the payment providers' (revenue/providers.tsx), in the brand orange.
const tileStyle: CSSProperties = {
  backgroundImage: "linear-gradient(to bottom, color-mix(in oklab, hsl(var(--primary)), white 18%), hsl(var(--primary)))",
  boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.35), inset 0 -2px 0 color-mix(in oklab, hsl(var(--primary)), black 30%)",
};

/** Centered card for an empty list or a missing resource ("large": for a whole page). */
export function EmptyState({ icon: Icon, visual, title, description, action, size = "default", className }: EmptyStateProps) {
  if (size === "large") {
    return (
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className={cn("card-3d flex flex-col items-center px-5 pb-12 pt-10 text-center sm:px-10 sm:pb-16 sm:pt-14", className)}
      >
        {visual ?? (
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-[13px] text-white" style={tileStyle}>
            <Icon className="h-[50%] w-[50%]" />
          </span>
        )}
        <h2 className="mt-6 max-w-xl text-balance font-display text-2xl font-light leading-tight sm:text-[32px]">{title}</h2>
        {description && <p className="mt-3 max-w-md text-balance text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-8 flex w-full justify-center">{action}</div>}
      </motion.section>
    );
  }

  return (
    <div className={cn("card-3d flex flex-col items-center gap-3 p-8 text-center", className)}>
      <span aria-hidden className="flex">
        <Icon className="size-8 text-muted-foreground" />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
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
