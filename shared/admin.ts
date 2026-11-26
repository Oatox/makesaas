import type { CoachMessage } from "./coach";
import type { OnboardingProfile } from "./onboarding-profile";
import type { RevenueProvider } from "./revenue";
import type { RoadmapState } from "./roadmap";

/**
 * A member's journey, as admins see it on their page (/admin/users/:id): their onboarding answers and
 * goal, their SaaS, and for one SaaS at a time where it stands (its roadmap, figures, connections and
 * use of the app). Read by the server with the secret key; looking never writes anything (the roadmap
 * is checked without saving what it sees).
 */

/** A SaaS of the member, in the list of their SaaS. */
export type AdminSaasSummary = { id: string; name: string; logoUrl: string | null; createdAt: string };

/** The `journey` of GET /api/admin/users/:id/details. */
export type AdminMemberJourney = {
  /** Their monthly goal from the onboarding; null when they gave none (the roadmap then aims at DEFAULT_MONTHLY_GOAL). */
  monthlyGoal: number | null;
  /** Their onboarding answers; null when none were saved. */
  onboarding: OnboardingProfile | null;
  /** SaaS ideas: the requests to Gus that succeeded, and the ideas shown to the member. */
  ideas: { requests: number; shown: number };
  /** Oldest first. */
  saas: AdminSaasSummary[];
  /** The SaaS they have open in the app. */
  currentSaasId: string | null;
};

/** GET adminApi.saas: one SaaS of the member and where it stands. */
export type AdminSaasDetail = AdminSaasSummary & {
  description: string | null;
  audience: string | null;
  appUrl: string | null;
  /** The idea of Gus it was kept from (its main feature, its problem, its advised monthly price); null when created by its name. */
  idea: { feature: string | null; problem: string | null; price: number | null } | null;
  /** Its roadmap, as the member sees it on Accueil and Roadmap. */
  roadmap: RoadmapState;
  /** Its payment account; null when none is connected. */
  payment: {
    provider: RevenueProvider;
    accountName: string | null;
    /** False for a test account: its payments never count. */
    livemode: boolean;
    lastSyncedAt: string | null;
    lastError: string | null;
  } | null;
  /** The live account's figures, in its main currency; null without a synced live account. */
  revenue: { currency: string; mrr: number; revenue30d: number; subscribers: number } | null;
  tiktok: {
    /** Most followed first. */
    accounts: { handle: string; followers: number; isPrivate: boolean; syncError: string | null }[];
    /** Videos seen on its accounts; those of the last 30 days and their views. */
    videos: number;
    videos30d: number;
    views30d: number;
    lastPostAt: string | null;
  };
  /** Carousels made (ready ones). */
  carousels: number;
  /** Its discussions with Gus: how many, and the latest ones (ADMIN_DISCUSSIONS_LISTED at most), latest activity first. */
  discussions: { total: number; latest: AdminDiscussionSummary[] };
};

export const ADMIN_DISCUSSIONS_LISTED = 100;

/** A discussion with Gus, in the list of a SaaS's discussions. */
export type AdminDiscussionSummary = {
  id: string;
  title: string;
  createdAt: string;
  /** Time of its last message. */
  updatedAt: string;
  /** Its messages, the member's and Gus's. */
  messages: number;
};

/** GET adminApi.discussion: a discussion with Gus and its messages, oldest first. */
export type AdminDiscussion = AdminDiscussionSummary & { saasId: string; thread: CoachMessage[] };

/** Periods of the Onboarding page, in days. */
export const ONBOARDING_STATS_PERIODS = [7, 30, 90] as const;
export type OnboardingStatsPeriod = (typeof ONBOARDING_STATS_PERIODS)[number];

export const isOnboardingStatsPeriod = (days: number): days is OnboardingStatsPeriod =>
  (ONBOARDING_STATS_PERIODS as readonly number[]).includes(days);

/** One step of the funnel (ONBOARDING_FUNNEL in shared/analytics.ts): the visitors who reached it. */
export type OnboardingFunnelStep = { label: string; users: number };

/**
 * The kinds of device the Onboarding page splits visitors by (from Amplitude's device type and
 * browser, server/admin/onboarding.ts): `in-app` is the browser inside an app (TikTok, Instagram,
 * Google...), whatever the device; `mobile` the phone's own browser.
 */
export const DEVICE_KINDS = ["desktop", "tablet", "in-app", "mobile"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];
/** Visitors per kind of device (a visitor seen on two kinds counts in both). */
export type DeviceCounts = Record<DeviceKind, number>;

/** A screen shown at a position of the onboarding (its step id) and the visitors who saw it. */
export type OnboardingScreenVariant = { stepId: string; users: number };

/**
 * One position in the onboarding (its Nth screen) and the visitors who reached it, in all and per
 * kind of device. The screens a position shows can differ with the answers (the branches after
 * "experience"): `variants` lists them, each with its visitors.
 */
export type OnboardingScreenStat = { number: number; variants: OnboardingScreenVariant[]; users: number; devices: DeviceCounts };

/** GET adminApi.onboarding?days=: the onboarding's funnel and screens over the period, from Amplitude. */
export type AdminOnboardingStats = {
  days: OnboardingStatsPeriod;
  funnel: OnboardingFunnelStep[];
  /** The landing page's visitors (the funnel's first step), per kind of device. */
  landing: { users: number; devices: DeviceCounts };
  screens: OnboardingScreenStat[];
  /** When Amplitude computed these figures (they are kept a few minutes). */
  computedAt: string;
};

/** The answer ids one request can ask for (a screen's branches, or its quick questions). */
export const MAX_ANSWER_KEYS = 12;

/**
 * The answers given to one question of the onboarding (the `onboarding_<key>` user property) by the
 * visitors of the period: each value picked and its visitors (a multiple choice counts a visitor once
 * per option picked), and the visitors who answered at all.
 */
export type OnboardingAnswerStat = { key: string; respondents: number; values: { value: string; users: number }[] };

/**
 * GET adminApi.onboardingScreen?days=&number=&last=&keys=: one screen of the onboarding over the period
 * (`number` 0: the landing page), opened from the admin's list.
 */
export type AdminOnboardingScreen = {
  /** Median time from the screen's view to the next screen's (the onboarding's end after the last one), in seconds; null when nobody went on. */
  medianSeconds: number | null;
  /** The answers to its questions, in the order of the `keys` asked. */
  answers: OnboardingAnswerStat[];
  computedAt: string;
};

export const adminApi = {
  onboarding: "/api/admin/onboarding",
  onboardingScreen: "/api/admin/onboarding/screen",
  userDetails: (userId: string) => `/api/admin/users/${userId}/details`,
  saas: (userId: string, saasId: string) => `/api/admin/users/${userId}/saas/${saasId}`,
  discussion: (userId: string, conversationId: string) => `/api/admin/users/${userId}/discussions/${conversationId}`,
} as const;
