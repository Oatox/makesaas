import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CreditCard,
  Globe,
  Lightbulb,
  Loader2,
  Lock,
  Map as MapIcon,
  MessageCircle,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import { OFFERS, RECOMMENDED_OFFER, type CheckoutSession, type OfferKey, type PaywallOffer } from "@shared/billing";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { InitialAvatar } from "@/components/onboarding/FounderProfileStep";
import { euros, firstName, goalOf, roadmapSteps } from "@/components/onboarding/insights";
import { MessageStep } from "@/components/onboarding/MessageStep";
import { OnboardingDialogHeader } from "@/components/onboarding/OnboardingDialog";
import { optionCardClass, SelectionWash } from "@/components/onboarding/OptionCard";
import { STEP_TITLE_CLASS, stepAppear } from "@/components/onboarding/StepHeader";
import type { MessageStep as MessageStepConfig } from "@/components/onboarding/steps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/StateCard";
import { TESTIMONIALS } from "@/components/landing/Testimonials";
import { LEGAL } from "@/config/legal";
import { MEMBER_COUNT_SHORT } from "@/config/social-proof";
import { AUTH_CONFIG } from "@/config/auth";
import { useAuth } from "@/hooks/use-auth";
import { useSaveOnboardingProfile } from "@/hooks/use-ideas";
import { useSaas } from "@/hooks/use-saas";
import { createCheckout, usePaywallOffers } from "@/hooks/use-billing";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { loadOnboardingProgress, type OnboardingAnswers } from "@/lib/onboarding-storage";
import { ANALYTICS_EVENTS } from "@shared/analytics";
import { cn } from "@/lib/utils";

const WhopCheckout = lazy(() => import("./WhopCheckout"));
const WhopExpressCheckout = lazy(() => import("./WhopCheckout").then((m) => ({ default: m.WhopExpressCheckout })));

/*
 * The paywall, in two screens laid out like the onboarding (same page frame, title, cards and
 * button): the guarantee promised to the member first, then the offers (1, 3 or 12 months) with
 * Whop's checkout embedded right under them, ready for the offer picked.
 */

// ⚠️ PLACEHOLDER: the guarantee must say the same as article 8 of the CGV (pages/CGV.tsx), its target.
const GUARANTEE_HREF = "/cgv#garantie";

/** First screen, an onboarding message screen: the promise answering the one the member just signed (PactStep). */
const PROMISE: MessageStepConfig = {
  id: "promesse",
  type: "message",
  icon: ShieldCheck,
  kicker: "Avant d'aller plus loin",
  title: "Tu t'es fait une promesse. Voici la nôtre.",
  body: "Si tu ne fais **aucune vente en 48 heures** en suivant ton plan, on te **rembourse ton premier paiement**.",
};

/**
 * What the subscription unlocks, in the member's words; the roadmap goes up to the monthly goal
 * picked in the onboarding. ⚠️ PLACEHOLDER: check each line against what the product really does.
 */
function unlocksFor(answers: OnboardingAnswers): { icon: LucideIcon; title: string; detail: string }[] {
  const goal = typeof answers.revenu === "string" ? `Jusqu'à ${euros.format(goalOf(answers))} par mois` : "Jusqu'à ton objectif";
  return [
    { icon: Lightbulb, title: "Une idée prête à être créée", detail: "Choisie parmi 3 pistes faites pour ton profil" },
    { icon: Globe, title: "Tout pour créer ton site", detail: "Le prompt et les logiciels, sans code" },
    { icon: MapIcon, title: "Une roadmap 3D, étape par étape", detail: goal },
    { icon: Target, title: "Ta stratégie pour tes premiers clients", detail: "Les canaux qui marchent pour ton projet" },
    { icon: MessageCircle, title: "Un coach personnel, chaque jour", detail: `${COACH_NAME} te dit quoi faire aujourd'hui` },
  ];
}

// ⚠️ PLACEHOLDER: the last questions before paying, answered straight.
const PAYWALL_FAQ = [
  {
    q: `Qu'est-ce que ${COACH_NAME} a de plus qu'un chatbot ?`,
    a: `Un chatbot repart de zéro à chaque conversation. ${COACH_NAME} garde ton projet en mémoire, connaît ton plan et te dit quoi faire aujourd'hui pour avancer.`,
  },
  {
    q: "Je peux annuler quand je veux ?",
    a: "Oui, depuis tes paramètres, sans justification. Tu gardes l'accès jusqu'à la fin de la période payée.",
  },
  {
    q: "Je n'ai pas encore d'idée, c'est grave ?",
    a: `Non. ${COACH_NAME} part de ce qui te passionne et du temps que tu as pour te proposer des idées faites pour toi.`,
  },
  {
    q: "Comment marche la garantie ?",
    a: "Mets ton offre en ligne avec un vrai paiement avant ta première vidéo, puis publie au moins 6 vidéos dans les 48 heures, dans les formats de ton plan. Sans aucune vente, écris-nous dans les 30 jours : on te rembourse ton premier paiement.",
  },
];

/** How long to wait for the Whop webhook after the payment before suggesting a reload. */
const ACTIVATION_TIMEOUT_MS = 60_000;
const ACTIVATION_POLL_MS = 2_000;
/** Whop's status query param once paid: "success" on redirect_url, "succeeded" on off-site steps. */
const SUCCESS_STATUSES = new Set(["success", "succeeded"]);
/** Creating a checkout taking longer than this shows the error (and its retry). */
const CHECKOUT_TIMEOUT_MS = 20_000;
const CHECKOUT_ERROR = "Le paiement n'a pas pu s'ouvrir. Réessaie.";
/** The promise is shown once per visit: a reload or a return from Whop goes straight to the offers. */
const PROMISE_SEEN_KEY = "makesaas:paywall-promise-seen";

// Same as the onboarding steps (pages/Onboarding.tsx): the container only handles the exit, its
// content appears piece by piece (stepAppear).
const screenMotion = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, x: -24, filter: "blur(6px)", transition: { duration: 0.2 } },
};
const stagger = { initial: "hidden", animate: "visible", variants: { visible: { transition: { staggerChildren: 0.07 } } } } as const;

/** Sub-heading of the offers screen, a smaller onboarding title (STEP_TITLE_CLASS). */
const SECTION_TITLE_CLASS = "font-display text-[22px] font-light leading-tight sm:text-[24px] md:text-[28px]";

/* ------------------------------------------------------------------ */
/* Offers                                                              */
/* ------------------------------------------------------------------ */

type OfferView = {
  key: OfferKey;
  name: string;
  period: string;
  /** null: no price from Whop (the checkout still shows it). */
  price: string | null;
  /** What the same length costs month by month, struck through, and the saving. */
  compareAt: string | null;
  saving: string | null;
  perDay: string | null;
};

const cents = (amount: number) => Math.round(amount * 100) / 100;

function money(amount: number, currency: string, decimals?: 2) {
  const value = cents(amount);
  const fraction = decimals ?? (Number.isInteger(value) ? 0 : 2);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: fraction,
    maximumFractionDigits: 2,
  }).format(value);
}

function describeOffer(offer: PaywallOffer, monthly: PaywallOffer | undefined): OfferView {
  const details = OFFERS[offer.key];
  const base = { key: offer.key, name: details.name, period: details.period };

  if (offer.price === null || !offer.currency) {
    return { ...base, price: null, compareAt: null, saving: null, perDay: null };
  }

  const { price, currency } = offer;
  const reference =
    offer.key !== "monthly" && monthly?.price && monthly.currency === currency ? cents(monthly.price * details.months) : null;
  const saving = reference && price < reference ? Math.round((1 - price / reference) * 100) : null;

  return {
    ...base,
    price: money(price, currency),
    compareAt: saving ? money(reference!, currency) : null,
    saving: saving ? `-${saving} %` : null,
    perDay: money(price / details.days, currency, 2),
  };
}

/** The offer selected when the paywall opens: the recommended one if it is on sale. */
function defaultOffer(offers: PaywallOffer[]): OfferKey {
  return offers.some((o) => o.key === RECOMMENDED_OFFER) ? RECOMMENDED_OFFER : offers[0].key;
}

/**
 * The plan built at the end of the onboarding (BuildStep), locked: its steps blurred under a "Touche
 * pour voir ton plan" pill. A tap brings the steps a little closer to readable, says one step is
 * left, and leads to the offers.
 */
function PlanPeek({ answers, onOpen }: { answers: OnboardingAnswers; onOpen: () => void }) {
  const [peek, setPeek] = useState(false);
  const named = typeof answers.prenom === "string" && answers.prenom.trim() !== "";
  const name = firstName(answers);
  const steps = roadmapSteps(answers);

  const open = () => {
    if (peek) return onOpen();
    setPeek(true);
    window.setTimeout(onOpen, 650);
  };

  return (
    <motion.div
      variants={stepAppear}
      role="button"
      tabIndex={0}
      aria-label="Voir ton plan"
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className="card-3d relative mt-7 cursor-pointer overflow-hidden px-4 pb-1.5 pt-4 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:px-5 md:pt-5"
      data-testid="paywall-plan-peek"
    >
      <div className="flex items-center gap-3">
        {named ? <InitialAvatar name={name} className="h-10 w-10 md:h-11 md:w-11" /> : <CoachAvatar className="h-10 w-10 md:h-11 md:w-11" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold md:text-lg">{named ? `Le plan de ${name}` : "Ton plan"}</p>
          <p className="text-sm text-muted-foreground">Objectif : {euros.format(goalOf(answers))} par mois</p>
        </div>
        <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
          Prêt
        </span>
      </div>

      <ol className="mt-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-center gap-3 border-t border-border/60 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white/15 text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            {/* Blurred, the first step a little less; a tap brings them all closer to readable. */}
            <div
              aria-hidden
              className={cn(
                "min-w-0 select-none transition-[filter] duration-500",
                peek ? "blur-[1.3px]" : i === 0 ? "blur-[2.2px]" : "blur-[4.5px]",
              )}
            >
              <b className="block text-[15px] font-semibold leading-tight">{step.title}</b>
              <small className="mt-1 block text-[13px] leading-snug text-muted-foreground">{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>

      <span className="pointer-events-none absolute left-1/2 top-[60%] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-primary/50 bg-background/90 px-4 py-2.5 text-sm font-semibold shadow-[0_10px_30px_rgb(0_0_0/0.5),0_0_30px_hsl(var(--primary)/0.2)] backdrop-blur-sm">
        <Lock className="h-4 w-4 text-primary" strokeWidth={2.25} />
        {peek ? "Encore une étape pour l'ouvrir" : "Touche pour voir ton plan"}
      </span>
    </motion.div>
  );
}

/** An offer, as an onboarding answer card (SingleChoiceStep): the radio where the icon sits, the price per day on the right. */
function OfferCard({ offer, checked, recommended, onSelect }: { offer: OfferView; checked: boolean; recommended: boolean; onSelect: () => void }) {
  return (
    <motion.div variants={stepAppear} className="relative">
      <motion.button
        whileTap={{ scale: 0.985 }}
        type="button"
        role="radio"
        aria-checked={checked}
        tabIndex={checked ? 0 : -1}
        onClick={onSelect}
        className={cn(optionCardClass(checked), "flex w-full items-center gap-4 py-3 pl-3 pr-5 text-left md:gap-5 md:py-4 md:pl-4 md:pr-6")}
        data-testid={`paywall-offer-${offer.key}`}
      >
        <SelectionWash selected={checked} />
        <span aria-hidden className="relative flex h-10 w-10 shrink-0 items-center justify-center md:h-12 md:w-12">
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full border-2 transition-colors duration-200",
              checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
            )}
          >
            {checked && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
          </span>
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-2 text-base font-semibold md:text-lg">
            {offer.name}
            {offer.saving && <span className="rounded-md bg-success px-1.5 py-0.5 text-xs font-bold text-success-foreground">{offer.saving}</span>}
          </span>
          <span className="mt-0.5 block text-sm tabular-nums text-muted-foreground md:text-base">
            {offer.price ? (
              <>
                {offer.compareAt && <s className="mr-1.5 text-muted-foreground/60">{offer.compareAt}</s>}
                <span className="text-foreground">{offer.price}</span> {offer.period}
              </>
            ) : (
              "Prix au paiement"
            )}
          </span>
        </span>
        {offer.perDay && (
          <span className="relative shrink-0 text-right">
            <span className="block font-display text-lg font-light tabular-nums md:text-xl">{offer.perDay}</span>
            <span className="block text-xs text-muted-foreground md:text-sm">par jour</span>
          </span>
        )}
      </motion.button>
      {recommended && (
        <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
          Recommandé
        </span>
      )}
    </motion.div>
  );
}

/** The member count with a few faces, same figures as the landing and the onboarding (config/social-proof). */
function MembersProof() {
  return (
    // One line on every screen: on phones the faces overlap more and the text follows the screen
    // width (12-13 px on most phones), so even a 320 px screen fits it.
    <motion.div variants={stepAppear} className="mt-6 flex items-center justify-center gap-2 sm:gap-3">
      <div className="flex shrink-0">
        {TESTIMONIALS.slice(0, 5).map((t, i) => (
          <img
            key={t.name}
            src={t.avatar}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            className="h-6 w-6 rounded-full object-cover ring-2 ring-background [&:not(:first-child)]:-ml-[9px] sm:h-8 sm:w-8 sm:[&:not(:first-child)]:-ml-2"
            style={{ zIndex: 5 - i }}
          />
        ))}
      </div>
      <p className="whitespace-nowrap text-[length:min(13px,3.2vw)] text-muted-foreground sm:text-sm md:text-base">
        <span className="font-semibold text-foreground">{MEMBER_COUNT_SHORT} utilisateurs</span> utilisent déjà {LEGAL.siteName}
      </p>
    </motion.div>
  );
}

/**
 * Apple Pay and Google Pay under the offers, for the selected one. Whop renders nothing without a
 * wallet on the device (or Apple Pay on the domain): the space below only comes with a button.
 */
function WalletButtons({ sessionId, environment, onPaid }: { sessionId: string; environment: "production" | "sandbox"; onPaid: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  // Whop's refusal ("paiement express indisponible") stays off the page: the card button is enough.
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setShown(element.offsetHeight > 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hidden = unavailable === sessionId;
  return (
    <div className={cn(shown && !hidden && "mb-2.5", hidden && "hidden")} data-testid="paywall-wallets">
      <div ref={ref}>
        <Suspense fallback={null}>
          <WhopExpressCheckout
            key={sessionId}
            sessionId={sessionId}
            environment={environment}
            onComplete={onPaid}
            onUnavailable={() => setUnavailable(sessionId)}
          />
        </Suspense>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-3.5 py-[18px]">
      {[0, 1, 2].map((i) => (
        <i key={i} className="block h-12 animate-pulse rounded-xl bg-white/[0.06]" />
      ))}
      <i className="mt-2.5 block h-[54px] animate-pulse rounded-full bg-white/[0.06]" />
    </div>
  );
}

/**
 * Whop's checkout for paying by card, in the app's modal: a drawer from the bottom on phones, a
 * centered dialog from `sm` up. Mounted on open only (Whop's form loads then).
 */
function CardCheckoutDialog({
  open,
  onOpenChange,
  sessionId,
  environment,
  email,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  environment: "production" | "sandbox";
  email?: string | null;
  onPaid: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-[480px]" aria-describedby={undefined} onOpenAutoFocus={(event) => event.preventDefault()}>
        <OnboardingDialogHeader title="Payer par carte" className="pr-10" />
        <div className="min-h-[420px] overflow-hidden rounded-2xl" data-testid="paywall-card-checkout">
          <Suspense fallback={<CheckoutSkeleton />}>
            <WhopCheckout key={sessionId} sessionId={sessionId} environment={environment} email={email} fallback={<CheckoutSkeleton />} onComplete={onPaid} />
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CheckoutState = { kind: "loading" } | { kind: "ready"; session: CheckoutSession } | { kind: "error"; message: string };

const smoothScroll = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/**
 * The purchase: the offers, Apple Pay / Google Pay (when the device has one) and the card button,
 * the guarantee, then the terms. Shown under the plan and again after the FAQ, both on the same
 * choice and checkout.
 */
function PurchaseBlock({
  offers,
  selected,
  onSelect,
  checkout,
  onRetryCheckout,
  environment,
  onPaid,
  onPayByCard,
  offersRef,
  className,
}: {
  offers: OfferView[] | null;
  selected: OfferKey | null;
  onSelect: (offer: OfferKey) => void;
  checkout: CheckoutState;
  onRetryCheckout: () => void;
  environment: "production" | "sandbox";
  onPaid: () => void;
  onPayByCard: () => void;
  /** The offers of the first block, where the plan card leads. */
  offersRef?: RefObject<HTMLDivElement>;
  className?: string;
}) {
  const payRef = useRef<HTMLDivElement>(null);

  // Picking an offer brings the payment buttons into view when they are still below the fold (phones).
  const pick = (offer: OfferKey) => {
    onSelect(offer);
    requestAnimationFrame(() => {
      const pay = payRef.current?.getBoundingClientRect();
      if (pay && pay.bottom > window.innerHeight) payRef.current?.scrollIntoView({ behavior: smoothScroll(), block: "end" });
    });
  };

  // Arrow keys move the choice, like native radio buttons.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!offers || !selected) return;
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = offers.findIndex((o) => o.key === selected);
    const next = offers[(index + step + offers.length) % offers.length];
    pick(next.key);
    event.currentTarget.querySelector<HTMLElement>(`[data-testid="paywall-offer-${next.key}"]`)?.focus();
  };

  return (
    <div className={className}>
      {/* Same column of cards as an onboarding question, a little tighter; 12 px still fit the
          "Recommandé" flag, half of which sits above its card. */}
      <div ref={offersRef} role="radiogroup" aria-label="Offres" onKeyDown={onKeyDown} className="flex scroll-mt-8 flex-col gap-3">
        {offers
          ? offers.map((offer) => (
              <OfferCard
                key={offer.key}
                offer={offer}
                checked={offer.key === selected}
                recommended={offer.key === RECOMMENDED_OFFER}
                onSelect={() => pick(offer.key)}
              />
            ))
          : [0, 1, 2].map((i) => <div key={i} aria-hidden className="h-[66px] animate-pulse rounded-2xl bg-card md:h-20" />)}
      </div>

      <motion.div variants={stepAppear} ref={payRef} className="mt-5 scroll-mb-6">
        {checkout.kind === "ready" && (
          <WalletButtons sessionId={checkout.session.sessionId} environment={environment} onPaid={onPaid} />
        )}
        {checkout.kind === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-center text-sm leading-relaxed md:text-base">
            <p>{checkout.message}</p>
            <Button variant="secondary" className="h-11" onClick={onRetryCheckout}>
              Réessayer
            </Button>
          </div>
        ) : (
          // Secondary, in the same card as the offers; the card form opens in a drawer.
          <motion.button
            type="button"
            whileTap={checkout.kind === "ready" ? { scale: 0.985 } : undefined}
            disabled={checkout.kind !== "ready"}
            onClick={onPayByCard}
            className={cn(
              optionCardClass(false),
              "flex h-14 w-full items-center justify-center gap-2.5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60 md:h-16 md:text-lg",
            )}
            data-testid="button-paywall-card"
          >
            {checkout.kind === "loading" ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <CreditCard className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            )}
            Payer par carte
          </motion.button>
        )}
      </motion.div>

      <motion.aside variants={stepAppear} className="mt-7 flex items-start gap-3 rounded-2xl border border-success/25 bg-success/[0.08] px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          <strong className="font-semibold text-success">Garantie 48 h :</strong> aucune vente ? Ton premier paiement est
          remboursé.{" "}
          <a href={GUARANTEE_HREF} target="_blank" rel="noopener" className="underline underline-offset-[3px] hover:text-foreground">
            Conditions
          </a>
        </p>
      </motion.aside>

      <motion.p variants={stepAppear} className="mt-4 text-xs leading-relaxed text-muted-foreground/70">
        En payant, tu acceptes les{" "}
        <a href="/cgv" target="_blank" rel="noopener" className="underline underline-offset-[3px] hover:text-foreground">
          conditions de vente
        </a>
        . Ton abonnement se renouvelle au même prix jusqu'à ce que tu le résilies. {LEGAL.siteName} ne garantit aucun
        revenu : tes résultats dépendent de ton travail et de ton marché.
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

/** Second screen: the offers, the checkout of the one picked, then what it unlocks and the FAQ. */
function OffersScreen({
  offers,
  offersError,
  onRetryOffers,
  selected,
  onSelect,
  checkout,
  onRetryCheckout,
  environment,
  onPaid,
}: {
  offers: OfferView[] | null;
  offersError: string | null;
  onRetryOffers: () => void;
  selected: OfferKey | null;
  onSelect: (offer: OfferKey) => void;
  checkout: CheckoutState;
  onRetryCheckout: () => void;
  environment: "production" | "sandbox";
  onPaid: () => void;
}) {
  const { user } = useAuth();
  const offersRef = useRef<HTMLDivElement>(null);
  const [cardOpen, setCardOpen] = useState(false);
  // The onboarding answers, kept on the device: without them (another device), no plan to show.
  const [answers] = useState(() => loadOnboardingProgress().answers);
  const hasPlan = Object.keys(answers).length > 0;
  // The same purchase under the plan and again after the FAQ: one choice, one checkout, one card drawer.
  const purchase = { offers, selected, onSelect, checkout, onRetryCheckout, environment, onPaid, onPayByCard: () => setCardOpen(true) };

  return (
    <motion.div className="flex flex-1 flex-col" {...stagger}>
      {/* The onboarding's title, shown at once (not typed out): it fades in like the rest. */}
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Investis sur toi-même pour atteindre tes objectifs.
      </motion.h1>

      {hasPlan && (
        <PlanPeek answers={answers} onOpen={() => offersRef.current?.scrollIntoView({ behavior: smoothScroll(), block: "start" })} />
      )}
      <MembersProof />

      {offersError ? (
        <motion.div variants={stepAppear} className="mt-7">
          <ErrorState title="Offres indisponibles" message={offersError} action={<Button onClick={onRetryOffers}>Réessayer</Button>} />
        </motion.div>
      ) : (
        <PurchaseBlock {...purchase} offersRef={offersRef} className="mt-7" />
      )}
      {checkout.kind === "ready" && (
        <CardCheckoutDialog
          open={cardOpen}
          onOpenChange={setCardOpen}
          sessionId={checkout.session.sessionId}
          environment={environment}
          email={user?.email}
          onPaid={onPaid}
        />
      )}

      <motion.section variants={stepAppear} aria-labelledby="paywall-unlocks" className="mt-12">
        <h2 id="paywall-unlocks" className={SECTION_TITLE_CLASS}>
          Ce que tu débloques
        </h2>
        {/* An orange icon, the title, its line under it: rows split by a thin line, no card. */}
        <ul className="mt-5 divide-y divide-border/60">
          {unlocksFor(answers).map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-start gap-3.5 py-4 first:pt-0 last:pb-0">
              <Icon aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.8} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight md:text-base">{title}</span>
                <span className="mt-1 block text-[13px] leading-snug text-muted-foreground md:text-sm">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.section variants={stepAppear} aria-labelledby="paywall-faq" className="mt-12">
        <h2 id="paywall-faq" className={SECTION_TITLE_CLASS}>
          Questions fréquentes
        </h2>
        <div className="mt-2">
          {PAYWALL_FAQ.map(({ q, a }) => (
            <details key={q} className="group border-b border-border/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold md:text-lg [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-2xl font-light leading-none text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-4 text-[15px] leading-relaxed text-muted-foreground md:text-base">{a}</p>
            </details>
          ))}
        </div>
      </motion.section>

      {/* The purchase again, for whoever read down to here. */}
      {!offersError && <PurchaseBlock {...purchase} className="mt-12" />}
    </motion.div>
  );
}

/** Waits for the webhook to grant access, then opens the app: Gus's ideas first, for a member without a project. */
function Activating() {
  const { hasAccess, retryProfile } = useAuth();
  const { saasList, isLoading: saasLoading, isError: saasError } = useSaas();
  const [, navigate] = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  const hasProject = saasList.length > 0 || saasError;

  useEffect(() => {
    if (hasAccess) {
      if (saasLoading) return;
      navigate(hasProject ? AUTH_CONFIG.REDIRECT_PATH : AUTH_CONFIG.LAUNCH_PATH, { replace: true });
      return;
    }
    const poll = window.setInterval(retryProfile, ACTIVATION_POLL_MS);
    const timeout = window.setTimeout(() => setTimedOut(true), ACTIVATION_TIMEOUT_MS);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timeout);
    };
  }, [hasAccess, saasLoading, hasProject, navigate, retryProfile]);

  return (
    <motion.div {...stagger} className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {timedOut ? (
        <>
          <ShieldCheck className="h-10 w-10 text-primary" />
          <motion.p variants={stepAppear} className="font-display text-xl font-light md:text-2xl">
            Paiement reçu, activation en cours
          </motion.p>
          <motion.p variants={stepAppear} className="max-w-sm text-base text-muted-foreground">
            L'activation prend plus de temps que prévu. Recharge la page dans un instant ; si ton accès n'apparaît
            toujours pas, écris-nous avec l'email utilisé pour le paiement.
          </motion.p>
          <Button variant="secondary" className="h-11" onClick={() => window.location.reload()}>
            Recharger
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <motion.p variants={stepAppear} className="font-display text-xl font-light md:text-2xl">
            Activation de ton abonnement…
          </motion.p>
          <motion.p variants={stepAppear} className="text-base text-muted-foreground">
            Encore quelques secondes.
          </motion.p>
        </>
      )}
    </motion.div>
  );
}

/** The onboarding's page frame (pages/Onboarding.tsx) without its header: the page starts with the title. */
function PaywallFrame({ screen, children }: { screen: string; children: ReactNode }) {
  return (
    <div className="bg-grain relative flex min-h-[100svh] flex-col bg-background">

      <main className="relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 pb-10 pt-5 sm:px-6 sm:pt-6 md:max-w-[680px] md:pt-8 md:[@media(max-height:820px)]:pt-4 [@media(max-height:720px)]:pb-5">
        <AnimatePresence mode="wait">
          <motion.div key={screen} className="flex flex-1 flex-col" {...screenMotion}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

const readFlag = (key: string) => {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/**
 * The paywall page: there is no free plan, this is the only way into the app. Access itself is
 * granted by the Whop webhook; this page waits for it once paid.
 */
export function Paywall() {
  const { hasAccess, retryProfile } = useAuth();
  const { toast } = useToast();
  // The onboarding answers go on the profile now: Gus's first ideas start as soon as the payment is
  // confirmed (Whop webhook), and they are written from these answers.
  useSaveOnboardingProfile();
  const offersQuery = usePaywallOffers();
  const status = new URLSearchParams(window.location.search).get("status");

  // Back from Whop (redirect_url after payment, or an off-site step like 3-D Secure / PayPal): Whop
  // appends status=success|succeeded|failed|canceled.
  const [activating, setActivating] = useState(() => SUCCESS_STATUSES.has(status ?? ""));
  const [screen, setScreen] = useState<"promise" | "offers">(() => (status || readFlag(PROMISE_SEEN_KEY) ? "offers" : "promise"));
  const [picked, setPicked] = useState<OfferKey | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const sold = offersQuery.data?.offers;
  const selected = picked ?? (sold?.length ? defaultOffer(sold) : null);
  const monthly = sold?.find((o) => o.key === "monthly");
  const offers = sold ? sold.map((o) => describeOffer(o, monthly)) : null;

  // Analytics: the paywall, its offers, the offer picked and the checkout entered (the payment itself
  // is sent by the server, from the Whop webhook).
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const pickOffer = (offer: OfferKey) => {
    setPicked(offer);
    track(ANALYTICS_EVENTS.offerSelected, { offer });
  };
  useEffect(() => {
    track(ANALYTICS_EVENTS.paywallViewed);
  }, []);
  const offersShown = screen === "offers" && !activating;
  useEffect(() => {
    if (offersShown) track(ANALYTICS_EVENTS.paywallOffersViewed);
  }, [offersShown]);

  useEffect(() => {
    if (status === "failed" || status === "canceled") {
      toast({ variant: "destructive", title: "Paiement non abouti", description: "Aucun montant n'a été débité. Tu peux réessayer." });
    }
  }, [status, toast]);

  // The checkout of the selected offer, prepared as soon as the offers are known (during the promise
  // already), and again for each offer picked: the previous request is dropped.
  useEffect(() => {
    if (!selected || activating) return;
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHECKOUT_TIMEOUT_MS);

    setCheckout({ kind: "loading" });
    createCheckout(selected, controller.signal)
      .then((session) => {
        if (!controller.signal.aborted) setCheckout({ kind: "ready", session });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted && !timedOut) return;
        // Already subscribed (paid in another tab): wait for the access, then open the app.
        if (error instanceof ApiError && error.status === 409) return setActivating(true);
        setCheckout({ kind: "error", message: !timedOut && error instanceof Error ? error.message : CHECKOUT_ERROR });
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selected, activating, attempt]);

  // Whop may keep the buyer on its own post-payment screens (e.g. the email code that sets up their
  // Whop account) without calling onComplete: once the buyer is in the checkout (focus inside its
  // frame), watch the subscription itself.
  const [inCheckout, setInCheckout] = useState(false);
  useEffect(() => {
    const onBlur = () => {
      if (document.activeElement instanceof HTMLIFrameElement) setInCheckout(true);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);
  useEffect(() => {
    if (inCheckout) track(ANALYTICS_EVENTS.checkoutStarted, { offer: selectedRef.current ?? undefined });
  }, [inCheckout]);
  useEffect(() => {
    if (!inCheckout || activating) return;
    if (hasAccess) {
      setActivating(true);
      return;
    }
    const poll = window.setInterval(retryProfile, ACTIVATION_POLL_MS * 2);
    return () => window.clearInterval(poll);
  }, [inCheckout, activating, hasAccess, retryProfile]);

  const showOffers = () => {
    try {
      window.sessionStorage.setItem(PROMISE_SEEN_KEY, "1");
    } catch {
      // Private mode: the promise shows again next time.
    }
    setScreen("offers");
    window.scrollTo({ top: 0 });
  };

  return (
    <PaywallFrame screen={activating ? "activating" : screen}>
      {activating ? (
        <Activating />
      ) : screen === "promise" ? (
        <MessageStep step={PROMISE} onContinue={showOffers} />
      ) : (
        <OffersScreen
          offers={offers}
          offersError={offersQuery.isError ? offersQuery.error.message : null}
          onRetryOffers={() => offersQuery.refetch()}
          selected={selected}
          onSelect={pickOffer}
          checkout={checkout}
          onRetryCheckout={() => setAttempt((n) => n + 1)}
          environment={offersQuery.data?.environment ?? "production"}
          onPaid={() => setActivating(true)}
        />
      )}
    </PaywallFrame>
  );
}
