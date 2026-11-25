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

/**
 * The funnel of the admin's Onboarding page (/admin/onboarding, read from Amplitude by
 * server/admin/onboarding.ts), in order. Its first step is the onboarding's first screen.
 */
export const ONBOARDING_FUNNEL: { event: AnalyticsEvent; label: string }[] = [
  { event: ANALYTICS_EVENTS.onboardingStepViewed, label: "Début de l'onboarding" },
  { event: ANALYTICS_EVENTS.accountCreated, label: "Compte créé" },
  { event: ANALYTICS_EVENTS.onboardingCompleted, label: "Onboarding terminé" },
  { event: ANALYTICS_EVENTS.paywallViewed, label: "Paywall vu" },
  { event: ANALYTICS_EVENTS.paywallOffersViewed, label: "Offres vues" },
  { event: ANALYTICS_EVENTS.checkoutStarted, label: "Paiement commencé" },
  { event: ANALYTICS_EVENTS.subscriptionStarted, label: "Abonné" },
];

/** Prefix of the user properties holding the onboarding answers (`onboarding_experience`...). */
export const ONBOARDING_PROPERTY_PREFIX = "onboarding_";
