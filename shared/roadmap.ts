import { z } from "zod";
import type { MissionProject } from "./roadmap-prompts";

/**
 * The roadmap of a SaaS (/roadmap): stages from the idea to the member's monthly goal (picked in the
 * onboarding, saved on profiles.monthly_goal), each made of missions with their tutorial
 * (shared/roadmap-missions.ts: roadmapStagesFor). A stage is done when all its missions are.
 *
 * A mission is done in one of two ways:
 *   - checked from the SaaS's data by the server (server/roadmap/), "observed" (or "before" when it
 *     happened before the SaaS was created on MakeSaaS; "declared" for what the member said, like the
 *     address of their app): saved once seen, and never undone, even when a connection breaks;
 *   - ticked by the member ("C'est fait"), "declared": they can untick it.
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
  /** A Stripe / Whop account is connected to the SaaS. */
  | { kind: "payment_account" }
  | { kind: "tiktok_accounts"; min: number }
  /** Videos posted on the SaaS's TikTok accounts. */
  | { kind: "videos"; min: number }
  /** A payment on the live connected account. */
  | { kind: "first_payment" }
  /** The MRR of the live connected account, compared in euros. */
  | { kind: "mrr"; amount: number };

/** An interactive block in a mission's tutorial. */
export type MissionTool =
  /** The prompt that builds the first version (buildAppPrompt), and Gus's discussion. */
  | "app_prompt"
  /** The prompt that adds the subscription screen (buildPaymentPrompt). */
  | "payment_prompt"
  /** The field where the member pastes the address of their app. */
  | "app_url"
  /** Opens the SaaS's settings, on its payment account. */
  | "payment_account";

export type RoadmapMission = {
  /** Stable: saved in roadmap_missions. "<stage>:<mission>". */
  key: string;
  title: string;
  /** Why it matters, in one sentence. */
  why: string;
  /** The tutorial, one step each (Gus's Markdown: **bold**, [links](https://…)). */
  steps: string[];
  check: MissionCheck;
  tool?: MissionTool;
  /** Pages of the app that help. */
  links?: { label: string; href: string }[];
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

/** POST roadmapApi.firstMission: opens (or finds) the discussion "Mettre ton app en ligne". */
export const firstMissionBodySchema = z.object({ saasId: z.string().uuid("SaaS invalide") });
export type FirstMissionResult = { conversationId: string };

/** Title of the discussion of the first mission: also how it is found again. */
export const FIRST_MISSION_TITLE = "Mettre ton app en ligne";

export const roadmapApi = {
  /** GET ?saasId= → RoadmapState, after checking the missions against the SaaS's data. */
  state: { path: "/api/roadmap" },
  /** PUT AppUrlBody → RoadmapState. */
  appUrl: { path: "/api/roadmap/app-url" },
  /** POST { saasId } → FirstMissionResult. */
  firstMission: { path: "/api/roadmap/first-mission" },
} as const;
