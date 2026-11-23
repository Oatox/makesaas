import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Paywall } from "@/components/billing/Paywall";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_CONFIG } from "@/config/auth";

/**
 * The paywall on its own page: where signed-in users without a subscription land (end of the
 * onboarding included). Whop also sends the buyer back here after an off-site payment step.
 */
export default function SubscribePage() {
  const { user, hasAccess, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // An account is needed to subscribe (the payment is tied to it).
  if (!user) return <Redirect to={AUTH_CONFIG.REGISTER_PATH} />;
  // Already subscribed; still show the page while activating after a payment (status in the URL).
  if (hasAccess && !window.location.search.includes("status=")) return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;

  return <Paywall />;
}
