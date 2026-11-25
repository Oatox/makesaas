import { subscriptionStateOf, type SubscriptionState, type SubscriptionSummary } from "@shared/billing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// A member's subscription in words and colors, the same on the users list and the member page
// (subscriptionStateOf in shared/billing.ts tells the state).

export type SubscriptionFields = Pick<SubscriptionSummary, "status" | "provider" | "cancel_at_period_end" | "current_period_end">;

/** Whop membership statuses, in words. */
const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Période d'essai",
  past_due: "Paiement en retard",
  completed: "Payé",
  canceling: "Annulation en cours",
  canceled: "Annulé",
  expired: "Expiré",
  unresolved: "Litige en cours",
  drafted: "Paiement non terminé",
};

type Tone = "ok" | "warn" | "off";

/** Each state as the users list filters it, and its color. */
export const SUBSCRIPTION_STATE_INFO: Record<SubscriptionState, { label: string; tone: Tone }> = {
  active: { label: "Actif", tone: "ok" },
  manual: { label: "Offert", tone: "ok" },
  ending: { label: "Renouvellement annulé", tone: "warn" },
  past_due: { label: "Paiement en retard", tone: "warn" },
  ended: { label: "Expiré ou annulé", tone: "off" },
  none: { label: "Sans abonnement", tone: "off" },
};

const TONE_DOTS: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-primary",
  off: "bg-muted-foreground/50",
};

/** The subscription in a few words: its Whop status, "Offert", or until when it still runs. */
export function subscriptionLabel(subscription: SubscriptionFields | null | undefined): string {
  const state = subscriptionStateOf(subscription);
  if (!subscription || state === "manual" || state === "past_due") return SUBSCRIPTION_STATE_INFO[state].label;
  if (state === "ending" && subscription.current_period_end) return `Actif jusqu'au ${formatDate(subscription.current_period_end)}`;
  return STATUS_LABELS[subscription.status] ?? subscription.status;
}

/** The colored dot of a state. */
export function SubscriptionDot({ state, className }: { state: SubscriptionState; className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE_DOTS[SUBSCRIPTION_STATE_INFO[state].tone], className)} />;
}
