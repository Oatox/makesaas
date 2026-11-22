import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteAccount } from "@/hooks/use-supabase";
import { tallInputClass } from "@/lib/field-styles";

/** Word to type to confirm the deletion. */
const DELETE_CONFIRMATION = "SUPPRIMER";

/** GDPR erasure of the account. Blocked while a subscription is active (it must be cancelled first). */
export function DeleteAccountDialog({ hasActiveBilling }: { hasActiveBilling: boolean }) {
  const deleteAccount = useDeleteAccount();
  const [confirmText, setConfirmText] = useState("");
  const canDelete = !hasActiveBilling && confirmText === DELETE_CONFIRMATION;

  return (
    <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="h-11 w-full shrink-0 px-5 sm:w-auto">
          Supprimer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Suppression définitive
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {hasActiveBilling ? (
                <div className="rounded-[12px] border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  Vous avez un abonnement actif. Veuillez d'abord le résilier depuis votre abonnement avant de pouvoir supprimer votre compte.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Toutes vos données seront supprimées conformément au RGPD. Cette action ne peut pas être annulée.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-delete" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Saisissez « {DELETE_CONFIRMATION} » pour confirmer
                    </Label>
                    <Input
                      id="confirm-delete"
                      placeholder={DELETE_CONFIRMATION}
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className={`${tallInputClass} focus-visible:border-destructive/70 focus-visible:ring-destructive/25`}
                    />
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          {!hasActiveBilling && (
            <AlertDialogAction
              onClick={(event) => {
                // Stay open with the spinner: success signs out and leaves the page, an error is toasted here.
                event.preventDefault();
                if (canDelete) deleteAccount.mutate();
              }}
              disabled={!canDelete || deleteAccount.isPending}
              variant="destructive"
            >
              {deleteAccount.isPending && <Loader2 className="animate-spin" />}
              Confirmer la suppression
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
