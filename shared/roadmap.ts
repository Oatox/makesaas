import { z } from "zod";
import type { MissionProject, MissionPrompt } from "./roadmap-prompts";

/**
 * The journey of a SaaS, from the idea to the member's monthly goal (picked in the onboarding, saved
 * on profiles.monthly_goal). Its content (shared/roadmap-missions.ts) is a list of stages
 * (roadmapStagesFor), each made of missions with their steps, and two views read it:
 *   - Accueil (/accueil): the day's tasks (shared/today.ts), the missions to do, a few each day;
 *   - Roadmap (/roadmap): the milestones (milestonesFor), only checked from the SaaS's data.
 *
 * A mission is done in one of two ways:
 *   - checked from the SaaS's data by the server (server/roadmap/), "observed" (or "before" when it
 *     happened before the SaaS was created on MakeSaaS; "declared" for what the member said, like the
 *     address of their app): saved once seen, and never undone, even when a connection breaks;
 *   - ticked by the member ("C'est fait"), "declared": they can untick it. They tick them in the
 *     roadmap's order (missionBlocker), and untick them from the last one back (canUntickMission).
 * Both live in public.roadmap_missions (section 14 of supabase_setup.sql).
 */

/** MRR tiers on the way to the goal: those under it are stages too. */
export const MRR_TIERS = [100, 1_000, 2_500, 5_000, 10_000] as const;

/** Goal of a member who did not give one (another device, an older account). */
export const DEFAULT_MONTHLY_GOAL = 10_000;

/** Mirrored by profiles_monthly_goal_check in supabase_setup.sql. */
export const MONTHLY_GOAL_RANGE = { min: 100, max: 1_000_000 } as const;

/** A monthly goal within range, in whole euros; the default one when missing or invalid. */
export function monthlyGoalOf(value: unknown): number {
  const goal = typeof value === "number" ? Math.round(value) : Number.NaN;
  return Number.isFinite(goal) && goal >= MONTHLY_GOAL_RANGE.min && goal <= MONTHLY_GOAL_RANGE.max ? goal : DEFAULT_MONTHLY_GOAL;
}

/** How a mission gets done: ticked by the member, or checked from the SaaS's data. */
export type MissionCheck =
  | { kind: "manual" }
  /** The SaaS exists. */
  | { kind: "saas" }
  /** The member gave the address of their app, and it answered. */
  | { kind: "app_url" }
  /** The SaaS has a logo (added from its settings). */
  | { kind: "logo" }
  /** A Stripe / Whop account is connected to the SaaS. */
  | { kind: "payment_account" }
  | { kind: "tiktok_accounts"; min: number }
  /** Videos posted on the SaaS's TikTok accounts. */
  | { kind: "videos"; min: number }
  /** A payment on the live connected account. */
  | { kind: "first_payment" }
  /** The MRR of the live connected account, compared in euros. */
  | { kind: "mrr"; amount: number };

/** The button of a mission's step: what the member does right there. */
export type StepAction =
  /** Opens a site in a new tab. */
  | { kind: "open"; label: string; url: string }
  /** Opens a page of MakeSaaS. */
  | { kind: "page"; label: string; href: string }
  /** Opens ChatGPT with this prompt already written (a new discussion). */
  | { kind: "chatgpt"; prompt: MissionPrompt }
  /** Copies this prompt, shown folded, to paste into Base44 or into a ChatGPT discussion already open. */
  | { kind: "copy"; prompt: MissionPrompt }
  /** Opens a new discussion with Gus, starting with this message. */
  | { kind: "gus"; label: string; message: string }
  /** Opens the SaaS's settings on one of its tabs (its logo, its payment account). */
  | { kind: "settings"; tab: "general" | "payments"; label: string }
  /** The field where the member pastes the address of their app. */
  | { kind: "app_url" };

/**
 * One step of a mission: a short sentence starting with a verb (Gus's Markdown: **bold**,
 * [links](https://…)), and at most one button. The member goes through them one at a time.
 */
export type MissionStep = { text: string; action?: StepAction };

/**
 * The banners a task can wear on Accueil (client/src/components/roadmap/TaskBanner.tsx), one per kind of
 * work. Gus picks one of them for each task he writes, so that his tasks look like the others.
 */
export const TASK_ILLUSTRATIONS = ["brand", "build", "launch", "account", "payment", "video", "community", "growth", "strategy"] as const;
export type TaskIllustration = (typeof TASK_ILLUSTRATIONS)[number];

export type RoadmapMission = {
  /** Stable: saved in roadmap_missions. "<stage>:<mission>". */
  key: string;
  title: string;
  /** Why it matters, in one short line: for Gus (the drawer shows the title, its time and its steps). */
  why: string;
  /** About how long it takes, in minutes, for what is done in one sitting. */
  minutes?: number;
  /** How long it takes otherwise ("7 jours"); neither: it happens on its own (a payment, an MRR). */
  span?: string;
  /** Its banner on Accueil; by default the one of its kind of work, from its key (illustrationOf). */
  illustration?: TaskIllustration;
  steps: MissionStep[];
  check: MissionCheck;
};

export type RoadmapStage = {
  key: string;
  title: string;
  /** Short name, in the stage cards. */
  label: string;
  /** What reaching it means. */
  detail: string;
  missions: RoadmapMission[];
  /** The MRR it ends on, for the MRR stages. */
  mrr?: number;
  /** The last stage: the member's own goal. */
  isGoal?: boolean;
};

/** declared: said or ticked by the member; observed: seen in their data, with its date; before: before MakeSaaS. */
export type MissionSource = "declared" | "observed" | "before";

export type MissionDone = { at: string; source: MissionSource };

/**
 * A milestone of the Roadmap page: checked from the SaaS's data by the mission of the same key, never
 * ticked by hand. "launch" ones come before the app's first video, "growth" ones after.
 */
export type Milestone = {
  key: string;
  title: string;
  /** What reaching it means, in one line. */
  detail: string;
  check: MissionCheck;
  phase: "launch" | "growth";
  /** The MRR it is reached at, for the MRR tiers. */
  mrr?: number;
  /** The last one: the member's own goal. */
  isGoal?: boolean;
  /** The page of the app with its figures. */
  link?: { label: string; href: string };
};

/** Where the SaaS stands, for the counters of the milestones in progress ("3 / 7 vidéos"). */
export type RoadmapProgress = {
  /** Videos seen on its TikTok accounts. */
  videos: number;
  tiktokAccounts: number;
  /** MRR of its live payment account today, in euros; null without one. */
  mrr: number | null;
};

/** What GET roadmapApi.state answers. The stages come from roadmapStagesFor(goal). */
export type RoadmapState = {
  /** The member's monthly goal: the last stage. */
  goal: number;
  /** For the prompts of the tutorials. */
  project: MissionProject;
  /** Address of the member's app, once given. */
  appUrl: string | null;
  /** Every mission done, by key (checked from the data, or ticked by the member). */
  done: Record<string, MissionDone>;
  progress: RoadmapProgress;
};

export type StageProgress = { done: number; total: number; complete: boolean };

export function stageProgress(stage: RoadmapStage, done: Record<string, MissionDone>): StageProgress {
  const count = stage.missions.filter((mission) => done[mission.key]).length;
  return { done: count, total: stage.missions.length, complete: count === stage.missions.length };
}

/** The stage the member is on: the first one not complete; null once every stage is. */
export function currentStageIndex(stages: RoadmapStage[], done: Record<string, MissionDone>): number | null {
  const index = stages.findIndex((stage) => !stageProgress(stage, done).complete);
  return index >= 0 ? index : null;
}

/** A mission in the roadmap's order, with its stage. */
export type MissionAt = { mission: RoadmapMission; stage: RoadmapStage; stageIndex: number };

/** Every mission in the roadmap's order: stage after stage, each stage's in its order. */
function missionsInOrder(stages: RoadmapStage[]): MissionAt[] {
  return stages.flatMap((stage, stageIndex) => stage.missions.map((mission) => ({ mission, stage, stageIndex })));
}

/**
 * The member ticks the missions in the roadmap's order: one waits until every mission before it (in
 * its stage, and in the stages before) is done. Returns the first of them still to do, or null when
 * the mission can be ticked. Missions checked from the data are done whenever they are seen, in any
 * order; they still hold back the missions after them.
 */
export function missionBlocker(stages: RoadmapStage[], done: Record<string, MissionDone>, key: string): MissionAt | null {
  for (const entry of missionsInOrder(stages)) {
    if (entry.mission.key === key) return null;
    if (!done[entry.mission.key]) return entry;
  }
  return null;
}

/**
 * The missions the member ticked after this one, in the roadmap's order. Unticking it unticks them
 * too ("Annuler", after a confirmation), so that none stays done before it.
 */
export function ticksAfter(stages: RoadmapStage[], done: Record<string, MissionDone>, key: string): string[] {
  const order = missionsInOrder(stages);
  const index = order.findIndex((entry) => entry.mission.key === key);
  return order
    .slice(index + 1)
    .filter(({ mission }) => mission.check.kind === "manual" && done[mission.key]?.source === "declared")
    .map(({ mission }) => mission.key);
}

/** Whether the member can untick a mission alone: no mission ticked after it (ticksAfter). */
export function canUntickMission(stages: RoadmapStage[], done: Record<string, MissionDone>, key: string): boolean {
  return ticksAfter(stages, done, key).length === 0;
}

/** Mirrored by roadmap_missions_key_check in supabase_setup.sql. */
export const MISSION_KEY_MAX_LENGTH = 60;

export const APP_URL_MAX_LENGTH = 300;

export const roadmapSaasQuerySchema = z.object({ saasId: z.string().uuid("SaaS invalide") });

/** PUT roadmapApi.appUrl: the address of the member's app (http or https). */
export const appUrlBodySchema = z.object({
  saasId: z.string().uuid("SaaS invalide"),
  url: z
    .string()
    .trim()
    .max(APP_URL_MAX_LENGTH, "Adresse trop longue")
    .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        const url = new URL(value);
        return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
      } catch {
        return false;
      }
    }, "Cette adresse n'est pas valide"),
});
export type AppUrlBody = z.input<typeof appUrlBodySchema>;

export const roadmapApi = {
  /** GET ?saasId= → RoadmapState, after checking the missions against the SaaS's data. */
  state: { path: "/api/roadmap" },
  /** PUT AppUrlBody → RoadmapState. */
  appUrl: { path: "/api/roadmap/app-url" },
} as const;
