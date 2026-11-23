import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  /**
   * The removal. The dialog closes once it resolves and stays open when it rejects (the caller or
   * its mutation shows the error).
   */
  onConfirm: () => Promise<unknown>;
  isPending: boolean;
  testId?: string;
};

/** "Are you sure?" before a destructive action of the SaaS settings, with a red confirm button. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, isPending, testId }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              // Stays open while the removal runs: the button shows it.
              event.preventDefault();
              onConfirm().then(
                () => onOpenChange(false),
                () => undefined,
              );
            }}
            data-testid={testId}
          >
            {isPending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
