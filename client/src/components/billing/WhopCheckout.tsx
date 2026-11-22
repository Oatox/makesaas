import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react";
import { loadWhop } from "@whop/elements";
import { Loader2 } from "lucide-react";
import type { PlanId } from "@shared/billing";

const loading = (
  <div className="flex min-h-[420px] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

/**
 * Whop's embedded checkout for a checkout configuration created by the server (it carries the
 * user id, which comes back on the membership). Loaded lazily: the Whop script is only fetched here.
 * onComplete only switches the UI: the plan itself is granted by the webhook.
 */
export default function WhopCheckout({
  sessionId,
  environment,
  email,
  plan,
  onComplete,
}: {
  sessionId: string;
  plan: PlanId;
  environment: "production" | "sandbox";
  email?: string | null;
  onComplete: () => void;
}) {
  return (
    <WhopElements
      elements={loadWhop()}
      environment={environment}
      locale="fr"
      appearance={{ theme: { appearance: "dark", accentColor: "orange", grayColor: "sand" } }}
    >
      <Checkout
        checkoutConfiguration={sessionId}
        // Off-site steps (3-D Secure, PayPal) come back to the paywall, which then waits for the webhook.
        returnUrl={`${window.location.origin}/abonnement?plan=${plan}`}
        onComplete={(result) => {
          if (result.result === "payment") onComplete();
        }}
      >
        <CheckoutElement buyerEmail={email ?? undefined} fallback={loading} />
      </Checkout>
    </WhopElements>
  );
}
