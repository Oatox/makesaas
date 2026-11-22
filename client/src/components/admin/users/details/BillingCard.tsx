import { CreditCard, Loader2 } from "lucide-react";
import { grantsAccess } from "@shared/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateAdminUser, type AdminUserDetailsResponse } from "@/hooks/use-admin-profiles";
import { formatDate } from "@/lib/format";

function describe(subscription: AdminUserDetailsResponse["profile"]["subscription"]) {
  if (!subscription) return "Aucun abonnement.";
  if (subscription.provider === "manual") return `Abonnement offert manuellement (${subscription.status}), sans facturation.`;

  const period = subscription.current_period_end
    ? `, ${subscription.cancel_at_period_end ? "se termine le" : "renouvelé le"} ${formatDate(subscription.current_period_end)}`
    : "";
  return `Abonnement Whop (${subscription.status})${period}. Le retirer ici n'arrête pas la facturation Whop.`;
}

/** The user's subscription, with a manual grant or removal (no billing involved). */
export function BillingCard({ profile }: { profile: AdminUserDetailsResponse["profile"] }) {
  const updateUser = useUpdateAdminUser();
  const subscribed = grantsAccess(profile.subscription?.status);
  const toggle = () => updateUser.mutate({ id: profile.id, updates: { subscribed: !subscribed } });

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Abonnement
            </CardTitle>
            <CardDescription>{describe(profile.subscription)}</CardDescription>
          </div>
          <Badge variant={subscribed ? "default" : "secondary"}>{subscribed ? "Abonné" : "Sans abonnement"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex pt-0 sm:justify-end">
        <Button
          variant={subscribed ? "secondary" : "default"}
          className="w-full sm:w-auto sm:min-w-36"
          onClick={toggle}
          disabled={updateUser.isPending}
        >
          {updateUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {subscribed ? "Retirer l'abonnement" : "Offrir l'abonnement"}
        </Button>
      </CardContent>
    </Card>
  );
}
