import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { dialogContentClass, dialogMobileSheetClass, dialogOverlayClass } from "@/lib/dialog-styles";
import { cn } from "@/lib/utils";

/**
 * The onboarding's dialog, in the app's modal look: a bottom sheet on phones (safe area), a
 * centered modal from `sm` up, focus kept inside. It can't be dismissed: the onboarding waits for
 * the visitor's tap. On open, focus goes to the dialog itself, not to its first button (a focused
 * answer would look picked already).
 */
export function OnboardingDialog({ open, describedBy = true, children }: { open: boolean; describedBy?: boolean; children: ReactNode }) {
  const keep = (event: Event) => event.preventDefault();

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={dialogOverlayClass} />
        <DialogPrimitive.Content
          className={cn(dialogContentClass, dialogMobileSheetClass, "outline-none")}
          onEscapeKeyDown={keep}
          onPointerDownOutside={keep}
          onInteractOutside={keep}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          {...(describedBy ? {} : { "aria-describedby": undefined })}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Title then the line under it, as every onboarding dialog shows them (`className`: centered...). */
export function OnboardingDialogHeader({ title, description, className }: { title: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <DialogPrimitive.Title className="text-balance font-display text-2xl font-light leading-tight">{title}</DialogPrimitive.Title>
      {description && <DialogPrimitive.Description className="mt-2 text-muted-foreground">{description}</DialogPrimitive.Description>}
    </div>
  );
}
