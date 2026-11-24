import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Paywall } from "@/components/billing/Paywall";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingAnswered } from "@/hooks/use-onboarding";
import { AUTH_CONFIG } from "@/config/auth";

/**
 * The paywall on its own page: where signed-in users without a subscription land (end of the
 * onboarding included). Whop also sends the buyer back here after an off-site payment step.
 */
export default function SubscribePage() {
  const { user, hasAccess, isLoading } = useAuth();
  const onboarding = useOnboardingAnswered();
  // Back from Whop: show the page while the subscription activates.
  const isReturning = window.location.search.includes("status=");

  if (isLoading || (user && !hasAccess && onboarding.isLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // An account is needed to subscribe (the payment is tied to it).
  if (!user) return <Redirect to={AUTH_CONFIG.REGISTER_PATH} />;
  if (hasAccess && !isReturning) return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;
  // Everyone goes through the onboarding before paying (an account opened from the sign-in page included).
  if (!hasAccess && !onboarding.answered && !isReturning) return <Redirect to={AUTH_CONFIG.ONBOARDING_PATH} replace />;

  return <Paywall />;
}
