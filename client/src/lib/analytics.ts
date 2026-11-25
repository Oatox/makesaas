import { ANALYTICS_EVENTS, type AnalyticsEvent } from "@shared/analytics";
import { AUTH_CONFIG } from "@/config/auth";

type Amplitude = typeof import("@amplitude/unified");
type UserProperties = Record<string, string | number | string[]>;

/**
 * Product analytics with Amplitude (events in shared/analytics.ts). The project API key is public
 * (ingestion only, it ships in the bundle): VITE_AMPLITUDE_API_KEY. Without it nothing is sent. The
 * SDK is loaded apart from the page (and never in the prerender): calls made before it is there wait
 * for it.
 */
const API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined;

let amplitude: Amplitude | null = null;
// Calls made while the SDK loads; null until initAnalytics (or without a key): they are dropped.
let pending: ((sdk: Amplitude) => void)[] | null = null;

function run(call: (sdk: Amplitude) => void) {
  if (amplitude) call(amplitude);
  else pending?.push(call);
}

// Session Replay shows the texts of the public journey (its inputs still masked). In the app and the
// admin every text is masked: members' projects, discussions with Gus, figures and other members'
// data never leave in a replay.
const PUBLIC_PAGES = [
  AUTH_CONFIG.ONBOARDING_PATH,
  AUTH_CONFIG.REGISTER_PATH,
  AUTH_CONFIG.LOGIN_PATH,
  AUTH_CONFIG.SUBSCRIBE_PATH,
];

function publicPageRules(origin: string) {
  const landing = [`${origin}/`, `${origin}/?*`, `${origin}/#*`];
  return [...landing, ...PUBLIC_PAGES.map((path) => `${origin}${path}*`)].map((match) => ({ match, maskLevel: "medium" as const }));
}

/** Starts Amplitude once, in the browser entry. */
export function initAnalytics() {
  if (typeof window === "undefined" || pending) return;
  if (!API_KEY) {
    console.warn("[amplitude] VITE_AMPLITUDE_API_KEY is not set — no events will be sent");
    return;
  }
  pending = [];

  import("@amplitude/unified")
    .then((sdk) => {
      // The key is the first argument: an options object alone initializes nothing.
      sdk
        .initAll(API_KEY, {
          serverZone: "EU", // the Amplitude project's data region (with AMPLITUDE_URL in server/lib/analytics.ts)
          analytics: { autocapture: true },
          sessionReplay: {
            sampleRate: 1,
            privacyConfig: { defaultMaskLevel: "conservative", urlMaskLevels: publicPageRules(window.location.origin) },
          },
        })
        .catch((err: unknown) => console.warn("[amplitude] init failed", err));
      amplitude = sdk;
      for (const call of pending ?? []) call(sdk);
      pending = [];
    })
    .catch((err: unknown) => {
      // Blocked by an ad blocker, or offline: analytics never stand in the way.
      console.warn("[amplitude] SDK not loaded", err);
      pending = null;
    });
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  run((sdk) => sdk.track(event, properties));
}

/** The signed-in member: their events, and those made before on this device, join their account. */
export function identifyUser(userId: string) {
  run((sdk) => {
    if (sdk.getUserId() !== userId) sdk.setUserId(userId);
  });
}

/** Signed out: whoever comes next on this device starts as a new anonymous visitor. */
export function resetUser() {
  run((sdk) => sdk.reset());
}

export function setUserProperties(properties: UserProperties) {
  run((sdk) => {
    const identify = new sdk.Identify();
    for (const [key, value] of Object.entries(properties)) identify.set(key, value);
    sdk.identify(identify);
  });
}

const NEW_ACCOUNT_MS = 60 * 60 * 1000;
const FIRST_SIGN_IN_MS = 60 * 1000;
const ACCOUNT_TRACKED_KEY = "makesaas_account_tracked_";

type SignedInUser = { id: string; created_at?: string; last_sign_in_at?: string; app_metadata?: { provider?: string } };

/**
 * "Account Created" on the first sign-in of an account opened in the last hour, by email or Google
 * (OAuth sign-ups come back through a redirect: the sign-in is the one moment both share). Only that
 * sign-in, right after the account was created: a sign-in on another device soon after is not a new
 * account. Once per account on this device.
 */
export function trackAccountCreated(user: SignedInUser) {
  const createdAt = user.created_at ? Date.parse(user.created_at) : 0;
  const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  if (!createdAt || Date.now() - createdAt > NEW_ACCOUNT_MS) return;
  if (!signedInAt || signedInAt - createdAt > FIRST_SIGN_IN_MS) return;

  try {
    if (localStorage.getItem(ACCOUNT_TRACKED_KEY + user.id)) return;
    localStorage.setItem(ACCOUNT_TRACKED_KEY + user.id, "1");
  } catch {
    return;
  }
  track(ANALYTICS_EVENTS.accountCreated, { method: user.app_metadata?.provider ?? "email" });
}
