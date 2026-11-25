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
 * One position in the onboarding (its Nth screen) and the visitors who reached it. The screens a
 * position shows can differ with the answers (the branches after "experience"): `stepIds` lists them.
 */
export type OnboardingScreenStat = { number: number; stepIds: string[]; users: number };

/** GET adminApi.onboarding?days=: the onboarding's funnel and screens over the period, from Amplitude. */
export type AdminOnboardingStats = {
  days: OnboardingStatsPeriod;
  funnel: OnboardingFunnelStep[];
  screens: OnboardingScreenStat[];
  /** When Amplitude computed these figures (they are kept a few minutes). */
  computedAt: string;
};

export const adminApi = {
  onboarding: "/api/admin/onboarding",
  userDetails: (userId: string) => `/api/admin/users/${userId}/details`,
  saas: (userId: string, saasId: string) => `/api/admin/users/${userId}/saas/${saasId}`,
  discussion: (userId: string, conversationId: string) => `/api/admin/users/${userId}/discussions/${conversationId}`,
} as const;
