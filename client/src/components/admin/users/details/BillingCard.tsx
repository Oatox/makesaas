import { useState } from "react";
import { CreditCard, Loader2, Save } from "lucide-react";
import { PLANS, activePlan, isPlanId, type PlanId } from "@shared/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateAdminUser, type AdminUserDetailsResponse } from "@/hooks/use-admin-profiles";
import { formatDate } from "@/lib/format";

const selectItemClass =
  "h-9 cursor-pointer rounded-md pr-2 pl-8 text-sm font-medium data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-accent-foreground";

// Select values cannot be null: "none" stands for "no subscription".
const NONE = "none";

export function BillingCard({ profile }: { profile: AdminUserDetailsResponse["profile"] }) {
  const updateUser = useUpdateAdminUser();
  // Plan picked but not saved yet; undefined = follow the stored value.
  const subscription = profile.subscription;
  const currentPlan = activePlan(subscription);
  const [draft, setDraft] = useState<PlanId | null | undefined>(undefined);
  const selected = draft === undefined ? currentPlan : draft;
  const isDirty = selected !== currentPlan;

  const save = () =>
    updateUser.mutate({ id: profile.id, updates: { plan: selected } }, { onSuccess: () => setDraft(undefined) });

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Abonnement
            </CardTitle>
            <CardDescription>
              {!subscription
                ? "Aucun abonnement."
                : subscription.provider === "whop"
                  ? `Abonnement Whop (${subscription.status})${
                      subscription.current_period_end
                        ? `, ${subscription.cancel_at_period_end ? "se termine le" : "renouvelé le"} ${formatDate(subscription.current_period_end)}`
                        : ""
                    }. Le retirer ici n'arrête pas la facturation Whop.`
                  : `Plan attribué manuellement (${subscription.status}), sans facturation.`}
            </CardDescription>
          </div>
          <Badge variant={selected ? "default" : "secondary"}>{selected ? `Plan ${PLANS[selected].name}` : "Sans abonnement"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Label htmlFor="admin-user-plan">Plan</Label>
            <Select
              value={selected ?? NONE}
              onValueChange={(value) => setDraft(isPlanId(value) ? value : null)}
              disabled={updateUser.isPending}
            >
              <SelectTrigger
                id="admin-user-plan"
                className="w-full sm:w-[200px] h-10 rounded-md border-sidebar-border bg-sidebar px-3 text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="end"
                className="min-w-[200px] rounded-lg border-sidebar-border bg-sidebar p-1 text-sidebar-foreground"
              >
                <SelectItem value={NONE} className={selectItemClass}>
                  Sans abonnement
                </SelectItem>
                {Object.values(PLANS).map((plan) => (
                  <SelectItem key={plan.id} value={plan.id} className={selectItemClass}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="sm:min-w-36" onClick={save} disabled={!isDirty || updateUser.isPending}>
            {updateUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sauvegarder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
