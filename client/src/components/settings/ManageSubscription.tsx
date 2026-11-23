import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PLAN, type SubscriptionSummary } from "@shared/billing";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSetCancelAtPeriodEnd } from "@/hooks/use-billing";
import { useToast } from "@/hooks/use-toast";

/**
 * Actions on a running Whop subscription, in the settings: cancel the renewal (confirmed first;
 * access stays until the paid period ends), or take a pending cancellation back.
 */
export function ManageSubscription({ subscription, periodEnd }: { subscription: SubscriptionSummary; periodEnd: string | null }) {
  const setCancel = useSetCancelAtPeriodEnd();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const until = periodEnd ? `jusqu'au ${periodEnd}` : "jusqu'à la fin de la période payée";

  const change = (cancel: boolean) =>
    setCancel.mutate(cancel, {
      onSuccess: () => {
        setConfirming(false);
        toast(
          cancel
            ? { title: "Abonnement résilié", description: `Vous gardez l'accès ${until}.` }
            : { title: "Abonnement repris", description: "Il se renouvellera normalement." },
        );
      },
      onError: (error) => toast({ variant: "destructive", title: "Action impossible", description: error.message }),
    });

  if (subscription.cancel_at_period_end) {
    return (
      <Button className="h-11 w-full shrink-0 px-5 sm:w-auto" onClick={() => change(false)} disabled={setCancel.isPending}>
        {setCancel.isPending && <Loader2 className="animate-spin" />}
        Reprendre mon abonnement
      </Button>
    );
  }

  return (
    <AlertDialog open={confirming} onOpenChange={(open) => !setCancel.isPending && setConfirming(open)}>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" className="h-11 w-full shrink-0 px-5 sm:w-auto">
          Résilier
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Résilier votre abonnement ?</AlertDialogTitle>
          <AlertDialogDescription>
            Il ne sera plus renouvelé. Vous gardez l'accès à {PLAN.name} {until}, et vous pouvez le reprendre d'ici là.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={setCancel.isPending}>Garder mon abonnement</AlertDialogCancel>
          {/* Stays open with the spinner until the change is saved; closes on success. */}
          <Button variant="destructive" onClick={() => change(true)} disabled={setCancel.isPending}>
            {setCancel.isPending && <Loader2 className="animate-spin" />}
            Résilier
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
