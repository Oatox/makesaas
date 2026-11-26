/**
 * Product analytics (Amplitude): the visitor's journey from the landing page to the payment, to see
 * where they leave. Page views, clicks and sessions come from the SDK's autocapture; these are the
 * product moments the app sends itself (client/src/lib/analytics.ts, and the payment from the server,
 * server/lib/analytics.ts). Keep the names stable: Amplitude's charts are built on them.
 */
export const ANALYTICS_EVENTS = {
  /**
   * A screen of the onboarding is shown: `step` (its label for charts, "04 social-proof": the number on
   * two digits keeps a sort as text in order), `step_id`, `step_type`, `step_number`, `step_count`.
   */
  onboardingStepViewed: "Onboarding Step Viewed",
  /** The last screen of the onboarding is passed: `step_count`. */
  onboardingCompleted: "Onboarding Completed",
  /** A new account, signed in for the first time: `method` (email, google). */
  accountCreated: "Account Created",
  /** The paywall is opened (its promise screen, or the offers when already seen). */
  paywallViewed: "Paywall Viewed",
  /** The offers and the checkout are shown. */
  paywallOffersViewed: "Paywall Offers Viewed",
  /** An offer is picked: `offer`. */
  offerSelected: "Offer Selected",
  /** The visitor enters Whop's checkout (focus inside its frame): `offer`. */
  checkoutStarted: "Checkout Started",
  /** A new subscription grants access (Whop webhook, sent by the server). */
  subscriptionStarted: "Subscription Started",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** The page views of the SDK's autocapture, and their path ("/" for the landing page). */
export const PAGE_VIEWED_EVENT = "[Amplitude] Page Viewed";
export const PAGE_PATH_PROPERTY = "[Amplitude] Page Path";

export type FunnelStep = {
  /** An event of the app, or autocapture's page view. */
  event: AnalyticsEvent | typeof PAGE_VIEWED_EVENT;
  label: string;
  /** Only the events whose property has this value. */
  where?: { property: string; value: string };
};

/** The landing page's views: the first step of the admin's funnel, counted apart from the others. */
export const LANDING_STEP: FunnelStep = { event: PAGE_VIEWED_EVENT, label: "Landing vue", where: { property: PAGE_PATH_PROPERTY, value: "/" } };

/**
 * The funnel of the admin's Onboarding page (/admin/onboarding, read from Amplitude by
 * server/admin/onboarding.ts), in order: the landing page's views, then from the onboarding's first
 * screen to the subscription. The landing page is counted on its own: the steps after it count every
 * visitor who started the onboarding, also those who came straight to /onboarding (a link to it,
 * "S'inscrire"), whom a funnel starting at the landing page would leave out of every step.
 */
export const ONBOARDING_FUNNEL: FunnelStep[] = [
  LANDING_STEP,
  { event: ANALYTICS_EVENTS.onboardingStepViewed, label: "Début de l'onboarding", where: { property: "step_number", value: "1" } },
  { event: ANALYTICS_EVENTS.accountCreated, label: "Compte créé" },
  { event: ANALYTICS_EVENTS.onboardingCompleted, label: "Onboarding terminé" },
  { event: ANALYTICS_EVENTS.paywallViewed, label: "Paywall vu" },
  { event: ANALYTICS_EVENTS.paywallOffersViewed, label: "Offres vues" },
  { event: ANALYTICS_EVENTS.checkoutStarted, label: "Paiement commencé" },
  { event: ANALYTICS_EVENTS.subscriptionStarted, label: "Abonné" },
];

/** Prefix of the user properties holding the onboarding answers (`onboarding_experience`...). */
export const ONBOARDING_PROPERTY_PREFIX = "onboarding_";
