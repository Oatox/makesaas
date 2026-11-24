import { z } from "zod";
import { onboardingProfileSchema } from "./onboarding-profile";

/**
 * SaaS ideas (/lancement, client/src/pages/Launch.tsx): right after paying, Gus shows 3 app ideas
 * made from the member's onboarding answers, the first one being the one he recommends. "D'autres
 * idées" shows 3 new ones (never one already proposed), and keeping one creates the member's SaaS
 * from it (saas.idea_id, straight from Supabase).
 *
 * One request to the model writes IDEAS_PER_REQUEST ideas, ranked from the most recommended: they
 * are shown IDEAS_PER_SERIES at a time (saas_idea_batches.revealed), so "D'autres idées" is instant
 * and free until they are all shown. A new request is made only then, or when the member steers the
 * ideas ("plus sportif"…): the ideas in stock were not written for that.
 *
 * A new member's first ideas are started by the Whop webhook as soon as the payment activates their
 * subscription, so that they are ready (or nearly) when the member lands on /lancement; the page
 * asks for them itself when there are none.
 *
 * Tables public.saas_idea_batches (one per request: daily quota, request in progress, ideas shown)
 * and public.saas_ideas (supabase_setup.sql, section 13): the server (server/ideas/) alone writes
 * them, members read them. The prompts are the `ideas` pipeline (shared/ai-pipeline.ts), edited by
 * admins at /admin/pipeline.
 */

/** Ideas written by one request to the model. Mirrored by saas_ideas_position_check. */
export const IDEAS_PER_REQUEST = 12;

/** Ideas shown at a time, the first being the one Gus recommends. */
export const IDEAS_PER_SERIES = 3;

/** Requests to the model per member over a rolling 24 h; failed ones do not count, nor do series shown from stock. */
export const IDEA_BATCHES_PER_DAY = 10;

/** A request takes about a minute: one still "running" after this was cut off (server restart). */
export const IDEA_BATCH_RUNNING_AT_MOST_MS = 5 * 60_000;

/** Latest ideas listed to the model so that it never proposes them again. */
export const IDEAS_SEEN_IN_PROMPT = 60;

/** What the member may add to steer the next ideas ("plus sportif", "pour les étudiants"…). */
export const IDEA_STEER_MAX_LENGTH = 200;

/** Lengths the model is held to (one short sentence each); longer texts are cut by the server. */
export const IDEA_TEXT_LIMITS = {
  name: 40,
  pitch: 120,
  feature: 140,
  problem: 140,
  audience: 90,
  whyYou: 140,
} as const;

/**
 * The app's single price: one monthly subscription, at a consumer (B2C) app price ending in ,99. The
 * Base44 prompts of the roadmap reuse it (shared/roadmap-prompts.ts). Ideas written before were whole
 * euros, up to 200.
 */
export const IDEA_PRICE_RANGE = { min: 2.99, max: 29.99 } as const;

/** The model's price brought to a consumer price: whole euros minus a cent, within IDEA_PRICE_RANGE (9 → 8,99 €). */
export function consumerPrice(price: number): number {
  const euros = Math.min(Math.round(IDEA_PRICE_RANGE.max), Math.max(Math.round(IDEA_PRICE_RANGE.min), Math.round(price)));
  return Math.round((euros - 0.01) * 100) / 100;
}

/** One idea, as stored in saas_ideas.content. */
export const ideaContentSchema = z.object({
  name: z.string().trim().min(1).max(IDEA_TEXT_LIMITS.name),
  /** What the app does, in one sentence. */
  pitch: z.string().trim().min(1).max(IDEA_TEXT_LIMITS.pitch),
  /**
   * Its main feature, concretely: what the user gives and what the app gives back ("une photo du repas
   * → ses calories et ses macros"). The Base44 prompt builds the app around it. Absent from the ideas
   * written before it.
   */
  feature: z.string().trim().min(1).max(IDEA_TEXT_LIMITS.feature).optional(),
  problem: z.string().trim().min(1).max(IDEA_TEXT_LIMITS.problem),
  audience: z.string().trim().min(1).max(IDEA_TEXT_LIMITS.audience),
  /** Monthly, in euros (consumerPrice). */
  price: z.number().min(IDEA_PRICE_RANGE.min).max(IDEA_PRICE_RANGE.max),
  /** Why it suits the member, said to them. */
  whyYou: z.string().trim().min(1).max(IDEA_TEXT_LIMITS.whyYou),
});
export type IdeaContent = z.infer<typeof ideaContentSchema>;

/** Row of public.saas_ideas as the client reads it. */
export type SaasIdea = {
  id: string;
  batch_id: string;
  /** Rank in its request, 0 being the most recommended: shown IDEAS_PER_SERIES at a time, in this order. */
  position: number;
  content: IdeaContent;
  created_at: string;
};

export const SAAS_IDEA_COLUMNS = "id, batch_id, position, content, created_at";

/** Row of public.saas_idea_batches as the client reads it: one per request to the model. */
export type SaasIdeaBatch = {
  id: string;
  status: "running" | "succeeded" | "failed";
  /** What the member asked for to steer it; null when nothing. */
  steer: string | null;
  /** Ideas shown so far (the first ones, by position), a multiple of IDEAS_PER_SERIES. */
  revealed: number;
  created_at: string;
};

export const SAAS_IDEA_BATCH_COLUMNS = "id, status, steer, revealed, created_at";

/** Ideas shown together: the first one is the one Gus recommends among them. */
export type IdeaSeries = { id: string; batchId: string; ideas: SaasIdea[] };

/**
 * The series shown to the member, newest first: each request's ideas cut in series of
 * IDEAS_PER_SERIES, up to what it revealed. `batches` and `ideas` may come in any order.
 */
export function revealedSeries(batches: Pick<SaasIdeaBatch, "id" | "revealed" | "created_at">[], ideas: SaasIdea[]): IdeaSeries[] {
  const byBatch = new Map<string, SaasIdea[]>();
  for (const idea of ideas) byBatch.set(idea.batch_id, [...(byBatch.get(idea.batch_id) ?? []), idea]);

  const series: IdeaSeries[] = [];
  const newestFirst = [...batches].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const batch of newestFirst) {
    const shown = (byBatch.get(batch.id) ?? []).filter((idea) => idea.position < batch.revealed).sort((a, b) => a.position - b.position);
    const count = Math.ceil(shown.length / IDEAS_PER_SERIES);
    // The last series revealed is the newest.
    for (let index = count - 1; index >= 0; index--) {
      series.push({
        id: `${batch.id}:${index}`,
        batchId: batch.id,
        ideas: shown.slice(index * IDEAS_PER_SERIES, (index + 1) * IDEAS_PER_SERIES),
      });
    }
  }
  return series;
}

/** POST body of ideasApi.next. */
export const nextIdeasBodySchema = z.object({
  /** The onboarding answers kept on this device: saved on the profile. Without them, the saved ones are used. */
  profile: onboardingProfileSchema.optional(),
  /** Steers the ideas: always a new request to the model. */
  steer: z.string().trim().max(IDEA_STEER_MAX_LENGTH).optional(),
});
export type NextIdeasBody = z.infer<typeof nextIdeasBodySchema>;

/** The series now shown, and whether it came from the ideas in stock (no request to the model). */
export type NextIdeasResult = { ideas: SaasIdea[]; fromStock: boolean };

export const ideasApi = {
  /**
   * POST NextIdeasBody, subscribers only → NextIdeasResult: the next ideas in stock at once, or, when
   * there are none left (or with a steer), once a new request has written them (about a minute).
   * 409 while another request of the member is running, 429 once the daily quota of requests is used.
   */
  next: { path: "/api/ideas/next" },
} as const;
