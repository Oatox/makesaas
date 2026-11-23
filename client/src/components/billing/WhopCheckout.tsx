import type { ReactNode } from "react";
import { Checkout, CheckoutElement, ExpressCheckoutElement, WhopElements } from "@whop/elements-react";
import { loadWhop } from "@whop/elements";
import { Loader2 } from "lucide-react";

const loading = (
  <div className="flex min-h-[420px] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

type Environment = "production" | "sandbox";

/**
 * Whop's provider and checkout for a checkout configuration created by the server (it carries the
 * user id, which comes back on the membership). The Whop script loads once, whatever the number of
 * checkouts on the page. onComplete only switches the UI: access itself is granted by the webhook.
 */
function WhopCheckoutFrame({
  sessionId,
  environment,
  onComplete,
  children,
}: {
  sessionId: string;
  environment: Environment;
  onComplete: () => void;
  children: ReactNode;
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
        returnUrl={`${window.location.origin}/abonnement`}
        onComplete={(result) => {
          if (result.result === "payment") onComplete();
        }}
      >
        {children}
      </Checkout>
    </WhopElements>
  );
}

/** Whop's embedded checkout (card and the other methods). Loaded lazily: the Whop script is only fetched here. */
export default function WhopCheckout({
  sessionId,
  environment,
  email,
  fallback = loading,
  onComplete,
}: {
  sessionId: string;
  environment: Environment;
  email?: string | null;
  /** Shown while Whop's form loads. */
  fallback?: ReactNode;
  onComplete: () => void;
}) {
  return (
    <WhopCheckoutFrame sessionId={sessionId} environment={environment} onComplete={onComplete}>
      <CheckoutElement buyerEmail={email ?? undefined} fallback={fallback} />
    </WhopCheckoutFrame>
  );
}

/**
 * One-press Apple Pay and Google Pay buttons for the same checkout configuration (a checkout mounts
 * either the full form or these buttons, hence a checkout of their own). Whop only renders the
 * wallets the device can pay with, and only on a domain with Apple Pay enabled on Whop (the
 * association file is served by server/billing/apple-pay.ts): nothing on localhost.
 */
export function WhopExpressCheckout({
  sessionId,
  environment,
  onComplete,
  onUnavailable,
}: {
  sessionId: string;
  environment: Environment;
  onComplete: () => void;
  /** Whop could not offer the buttons (it then shows a refusal, better left out of the page). */
  onUnavailable: () => void;
}) {
  return (
    <WhopCheckoutFrame sessionId={sessionId} environment={environment} onComplete={onComplete}>
      <ExpressCheckoutElement
        wallets={{ applePay: "auto", googlePay: "auto", payPal: "never" }}
        layout="auto"
        onError={(error) => {
          console.warn("[paywall] Apple Pay / Google Pay unavailable", error);
          onUnavailable();
        }}
      />
    </WhopCheckoutFrame>
  );
}
