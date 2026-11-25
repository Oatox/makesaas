import { useState } from "react";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { grantsAccess, subscriptionStateOf, type SubscriptionState } from "@shared/billing";
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
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateAdminUser, type AdminUserDetailsResponse } from "@/hooks/use-admin-profiles";
import { formatDate } from "@/lib/format";
import { SubscriptionDot, subscriptionLabel } from "../subscription-state";

type Profile = AdminUserDetailsResponse["profile"];

/** Where the member stands, in one line under the state's label. */
function detailOf(subscription: Profile["subscription"], state: SubscriptionState, isAdmin: boolean): string {
  const end = subscription?.current_period_end ? formatDate(subscription.current_period_end) : null;
  switch (state) {
    case "none":
      return isAdmin ? "A quand même accès à l'app, en tant qu'admin." : "N'a pas accès à l'app.";
    case "manual":
      return "Accès offert par un admin, sans facturation.";
    case "past_due":
      return "Whop retente le paiement ; l'accès reste ouvert en attendant.";
    case "ending":
      return "Whop · renouvellement annulé.";
    case "ended":
      if (subscription?.provider === "manual") return "Accès offert par un admin, terminé.";
      return end ? `Whop · terminé le ${end}` : "Whop · n'a plus accès à l'app.";
    case "active":
      if (!end) return "Whop";
      if (subscription?.status === "completed") return `Whop · sans renouvellement, accès jusqu'au ${end}`;
      return `Whop · ${subscription?.status === "trialing" ? "premier paiement" : "renouvelé"} le ${end}`;
  }
}

/**
 * The member's access to the app: their subscription at a glance, and an admin's grant or removal. A
 * removal first ends their Whop subscription, if one runs (the server refuses the removal when Whop fails).
 */
export function BillingCard({ profile }: { profile: Profile }) {
  const updateUser = useUpdateAdminUser();
  const [confirming, setConfirming] = useState(false);
  const subscription = profile.subscription;
  const subscribed = grantsAccess(subscription?.status);
  const state = subscriptionStateOf(subscription);
  const detail = detailOf(subscription, state, profile.role === "admin");
  const paidOnWhop = subscription?.provider === "whop" && subscribed;

  const confirm = () => updateUser.mutate({ id: profile.id, updates: { subscribed: !subscribed } });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            Abonnement
          </CardTitle>
          <CardDescription className="flex items-start gap-2">
            <SubscriptionDot state={state} className="mt-1.5" />
            <span>
              <span className="font-medium text-foreground">{subscriptionLabel(subscription)}</span> · {detail}
            </span>
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant={subscribed ? "outline" : "default"}
          className="shrink-0"
          onClick={() => setConfirming(true)}
          disabled={updateUser.isPending}
        >
          {updateUser.isPending && <Loader2 className="animate-spin" />}
          {subscribed ? "Retirer l'accès" : "Offrir l'accès"}
        </Button>
      </CardHeader>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{subscribed ? "Retirer son accès à l'app ?" : "Offrir l'accès à l'app ?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {subscribed
                ? `${profile.email || "Ce membre"} perd tout de suite l'accès à l'app.`
                : `${profile.email || "Ce membre"} aura accès à toute l'app, sans payer, jusqu'à ce qu'un admin le retire.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {paidOnWhop && (
            <p className="flex gap-2.5 rounded-lg border border-primary/30 bg-primary/[0.07] p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
              Son abonnement Whop sera annulé tout de suite : plus aucun prélèvement, et pas de remboursement de la période en
              cours. Si Whop ne répond pas, rien n'est modifié.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant={subscribed ? "destructive" : "default"} onClick={confirm}>
              {subscribed ? "Retirer l'accès" : "Offrir l'accès"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
