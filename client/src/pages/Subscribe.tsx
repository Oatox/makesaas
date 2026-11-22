import { useCallback, useState } from "react";
import { Link, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CheckoutBackButton, Paywall } from "@/components/billing/Paywall";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_CONFIG } from "@/config/auth";

/**
 * The paywall on its own page: where signed-in users without a subscription land. Whop also sends
 * the buyer back here after an off-site payment step.
 */
export default function SubscribePage() {
  const { user, hasAccess, isLoading, signOut } = useAuth();
  // While Whop's checkout is open the header swaps the logo for the "back to the offer" arrow,
  // which moves the checkout up.
  const [closeCheckout, setCloseCheckout] = useState<(() => void) | null>(null);
  const onCheckoutChange = useCallback((close: (() => void) | null) => setCloseCheckout(() => close), []);

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

  return (
    <div className="bg-grain relative flex min-h-[100svh] flex-col bg-background">
      <header className="relative z-10 flex w-full items-center justify-between gap-3 px-5 pb-2 pt-5 sm:px-6 md:px-8 md:pt-7">
        {closeCheckout ? (
          <CheckoutBackButton onClick={closeCheckout} />
        ) : (
          <Link href="/" aria-label="Accueil" className="transition-opacity hover:opacity-80">
            <Logo className="h-5" />
          </Link>
        )}
        {!hasAccess && (
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Se déconnecter
          </button>
        )}
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 pb-10 sm:px-6 md:max-w-[760px]",
          closeCheckout ? "pt-3 sm:pt-4 md:pt-6" : "pt-8 sm:pt-12 md:pt-16",
        )}
      >
        <Paywall onCheckoutChange={onCheckoutChange} />
      </main>
    </div>
  );
}
