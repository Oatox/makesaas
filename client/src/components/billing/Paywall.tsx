import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, LayoutDashboard, Loader2, ShieldCheck, Sparkles, Wand2, type LucideIcon } from "lucide-react";
import type { CheckoutSession, PaywallPlan } from "@shared/billing";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/StateCard";
import { optionCardClass, SelectionWash } from "@/components/onboarding/OptionCard";
import { STEP_TITLE_CLASS, stepAppear as appear } from "@/components/onboarding/StepHeader";
import { TESTIMONIALS } from "@/components/landing/Testimonials";
import { MEMBER_COUNT_SHORT } from "@/config/social-proof";
import { useAuth } from "@/hooks/use-auth";
import { useCreateCheckout, usePaywallPlan } from "@/hooks/use-billing";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const WhopCheckout = lazy(() => import("./WhopCheckout"));

/** What the plan includes, listed under its card. ⚠️ PLACEHOLDER: list your product's features. */
const INCLUDED_FEATURES: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: LayoutDashboard, title: "Tableau de bord", detail: "Toutes vos données au même endroit" },
  { icon: Sparkles, title: "IA intégrée", detail: "Des résultats générés en quelques secondes" },
  { icon: Wand2, title: "Prise en main rapide", detail: "Opérationnel en quelques minutes" },
  { icon: CreditCard, title: "Sans engagement", detail: "Résiliable à tout moment" },
];

/** How long to wait for the Whop webhook after the payment before suggesting a reload. */
const ACTIVATION_TIMEOUT_MS = 60_000;
const ACTIVATION_POLL_MS = 2_000;
/** Whop's status query param once paid: "success" on redirect_url, "succeeded" on off-site steps. */
const SUCCESS_STATUSES = new Set(["success", "succeeded"]);

function formatPrice(plan: PaywallPlan) {
  if (plan.price === null || !plan.currency) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(plan.price) ? 0 : 2,
  }).format(plan.price);
}

function PlanCard({ plan }: { plan: PaywallPlan }) {
  const price = formatPrice(plan);

  return (
    <motion.div
      variants={appear}
      className={cn(optionCardClass(true), "flex w-full items-center justify-between gap-4 px-5 py-4")}
      data-testid="paywall-plan"
    >
      <SelectionWash selected />
      <div className="relative min-w-0">
        <p className="font-display text-lg font-normal">{plan.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{plan.description}</p>
      </div>
      <p className="relative shrink-0 text-right">
        {price ? (
          <>
            <span className="font-display text-2xl font-light">{price}</span>
            <span className="text-sm text-muted-foreground"> / mois</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Prix au paiement</span>
        )}
      </p>
    </motion.div>
  );
}

/** Back from the checkout to the offer: the same arrow as the app header (AppLayout). */
export function CheckoutBackButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Revenir à l'offre"
      className={cn("-ml-2 h-12 w-12 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:h-8 md:w-8", className)}
    >
      <ArrowLeft className="!size-7 md:!size-5" />
    </Button>
  );
}

/** Waits for the webhook to grant access, then opens the app. */
function Activating() {
  const { hasAccess, retryProfile } = useAuth();
  const [, navigate] = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (hasAccess) {
      navigate("/app", { replace: true });
      return;
    }
    const poll = window.setInterval(retryProfile, ACTIVATION_POLL_MS);
    const timeout = window.setTimeout(() => setTimedOut(true), ACTIVATION_TIMEOUT_MS);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timeout);
    };
  }, [hasAccess, navigate, retryProfile]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {timedOut ? (
        <>
          <ShieldCheck className="h-10 w-10 text-primary" />
          <p className="font-display text-xl font-normal">Paiement reçu, activation en cours</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            L'activation prend plus de temps que prévu. Rechargez la page dans un instant ; si votre accès n'apparaît
            toujours pas, contactez-nous avec l'email utilisé pour le paiement.
          </p>
          <Button variant="secondary" className="h-11" onClick={() => window.location.reload()}>
            Recharger
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-display text-xl font-normal">Activation de votre abonnement…</p>
          <p className="text-sm text-muted-foreground">Encore quelques secondes.</p>
        </>
      )}
    </div>
  );
}

/**
 * The plan, then Whop's embedded checkout. There is no free plan: this is the only way into the app.
 *
 * With `onCheckoutChange`, the page draws the "back to the offer" arrow itself (in its header, so
 * the checkout sits higher): it receives the function closing the checkout, or null once closed.
 */
export function Paywall({
  title = "Débloquez MakeSaaS",
  onCheckoutChange,
}: {
  title?: string;
  onCheckoutChange?: (closeCheckout: (() => void) | null) => void;
}) {
  const { user, hasAccess, retryProfile } = useAuth();
  const { toast } = useToast();
  const planQuery = usePaywallPlan();
  const createCheckout = useCreateCheckout();

  // Back from Whop (redirect_url after payment, or an off-site step like 3-D Secure / PayPal): Whop
  // appends status=success|succeeded|failed|canceled.
  const [activating, setActivating] = useState(() =>
    SUCCESS_STATUSES.has(new URLSearchParams(window.location.search).get("status") ?? ""),
  );
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const closeCheckout = useCallback(() => setSession(null), []);

  const checkoutOpen = !!session && !activating;
  useEffect(() => {
    if (!onCheckoutChange) return;
    onCheckoutChange(checkoutOpen ? closeCheckout : null);
    return () => onCheckoutChange(null);
  }, [checkoutOpen, closeCheckout, onCheckoutChange]);

  // Whop may keep the buyer on its own post-payment screens (e.g. the email code that sets up their
  // Whop account) without calling onComplete: watch the subscription itself while the checkout is open.
  useEffect(() => {
    if (!session) return;
    if (hasAccess) {
      setActivating(true);
      return;
    }
    const poll = window.setInterval(retryProfile, ACTIVATION_POLL_MS * 2);
    return () => window.clearInterval(poll);
  }, [session, hasAccess, retryProfile]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status === "failed" || status === "canceled") {
      toast({ variant: "destructive", title: "Paiement non abouti", description: "Aucun montant n'a été débité. Vous pouvez réessayer." });
    }
  }, [toast]);

  if (activating) return <Activating />;

  if (planQuery.isError) {
    return (
      <ErrorState
        title="Offre indisponible"
        message={planQuery.error.message}
        action={<Button onClick={() => planQuery.refetch()}>Réessayer</Button>}
      />
    );
  }

  if (session && planQuery.data) {
    return (
      <div className="space-y-5">
        {!onCheckoutChange && <CheckoutBackButton onClick={closeCheckout} />}
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <Suspense fallback={<div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <WhopCheckout
              sessionId={session.sessionId}
              environment={planQuery.data.environment}
              email={user?.email}
              onComplete={() => setActivating(true)}
            />
          </Suspense>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Paiement sécurisé par Whop. Sans engagement, résiliable à tout moment.
        </p>
      </div>
    );
  }

  const plan = planQuery.data?.plan;
  const startCheckout = () =>
    createCheckout.mutate(undefined, {
      onSuccess: setSession,
      onError: (error) => toast({ variant: "destructive", title: "Paiement indisponible", description: error.message }),
    });

  return (
    <motion.div className="flex flex-1 flex-col gap-7" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>
      <div className="space-y-2">
        <motion.h1 variants={appear} className={STEP_TITLE_CLASS}>
          {title}
        </motion.h1>
        <motion.p variants={appear} className="text-base text-muted-foreground md:text-lg">
          Abonnement mensuel, sans engagement.
        </motion.p>
      </div>

      {plan ? (
        <PlanCard plan={plan} />
      ) : (
        <div className="flex min-h-[88px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Same raised card as the app's main panels, with a soft orange glow behind it. */}
      <motion.div variants={appear}>
        <ul className="divide-y divide-border/60" aria-label="Inclus dans l'abonnement">
          {INCLUDED_FEATURES.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-start gap-3.5 py-4 first:pt-0 last:pb-0">
              <Icon aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.8} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">{title}</span>
                <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Footer like the onboarding steps (ContinueButton): pinned to the bottom on mobile, under the
          content on desktop. */}
      <motion.div variants={appear} className="mt-auto space-y-4 pt-2 md:mx-auto md:mt-3 md:w-full md:max-w-[420px] md:pt-0">
        {/* Same member count and avatars as the landing and the onboarding (config/social-proof). */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex shrink-0">
            {TESTIMONIALS.slice(0, 5).map((t, i) => (
              <img
                key={t.name}
                src={t.avatar}
                alt=""
                width={32}
                height={32}
                loading="lazy"
                className="h-8 w-8 rounded-full object-cover ring-2 ring-background"
                style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{MEMBER_COUNT_SHORT} utilisateurs</span> utilisent déjà MakeSaaS
          </p>
        </div>
        <div className="md:mx-auto md:w-[320px]">
          <Button
            className="h-12 w-full text-base"
            onClick={startCheckout}
            disabled={!plan || createCheckout.isPending}
            data-testid="button-paywall-continue"
          >
            {createCheckout.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Continuer
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Paiement sécurisé · Sans engagement
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
