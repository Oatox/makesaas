import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_PIPELINE_SLUGS,
  ideasAiResultSchema,
  ideasResponseSchema,
  type AiPipelineUpdate,
  type IdeasAiResult,
  type IdeasTemplateVariable,
} from "@shared/ai-pipeline";
import {
  IDEA_BATCH_RUNNING_AT_MOST_MS,
  IDEA_BATCHES_PER_DAY,
  IDEA_PRICE_RANGE,
  IDEA_TEXT_LIMITS,
  IDEAS_PER_REQUEST,
  IDEAS_PER_SERIES,
  IDEAS_SEEN_IN_PROMPT,
  SAAS_IDEA_COLUMNS,
  ideaContentSchema,
  type IdeaContent,
  type SaasIdea,
} from "@shared/ideas";
import { formatOnboardingProfile, onboardingProfileSchema, type OnboardingProfile } from "@shared/onboarding-profile";
import { OneShotClient, type ChatMessage } from "../ai/oneshot-client";
import { AiPipelineNotFoundError, AiPipelineRepository, renderTemplate } from "../ai/pipelines";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { DAY_MS, MINUTE_MS } from "../lib/time";

const parisTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Cuts a text the model made too long, at a word when possible. */
function clip(text: string, max: number) {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The ideas of the model, held to the lengths and price range of an idea. */
export function toIdeaContents(result: IdeasAiResult): IdeaContent[] {
  return result.ideas.slice(0, IDEAS_PER_REQUEST).map((idea) =>
    ideaContentSchema.parse({
      name: clip(idea.name, IDEA_TEXT_LIMITS.name),
      pitch: clip(idea.pitch, IDEA_TEXT_LIMITS.pitch),
      problem: clip(idea.problem, IDEA_TEXT_LIMITS.problem),
      audience: clip(idea.audience, IDEA_TEXT_LIMITS.audience),
      price: Math.min(IDEA_PRICE_RANGE.max, Math.max(IDEA_PRICE_RANGE.min, Math.round(idea.price))),
      whyYou: clip(idea.whyYou, IDEA_TEXT_LIMITS.whyYou),
    }),
  );
}

/** The 4 messages of the pipeline, in order: system, data, instructions, format. */
export function buildIdeasMessages(pipeline: AiPipelineUpdate, variables: Record<IdeasTemplateVariable, string>): ChatMessage[] {
  return [
    { role: "system", content: renderTemplate(pipeline.system_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.data_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.instructions_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.output_format_prompt, variables) },
  ];
}

export type NextIdeasOptions = {
  /** Onboarding answers sent from the member's device: saved on the profile first. */
  profile?: OnboardingProfile;
  /** Steers the ideas: always a new request to the model. */
  steer?: string;
};

/**
 * SaaS ideas written by the `ideas` pipeline (admin-editable prompts) through OneShotAPI: on request
 * from /lancement, and once for a new member as soon as their subscription is activated. One request
 * writes IDEAS_PER_REQUEST ranked ideas, shown IDEAS_PER_SERIES at a time (saas_idea_batches.revealed).
 */
export class IdeasService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly oneshot: OneShotClient,
  ) {}

  /**
   * The member's next series: the next ideas in stock at once, or, when none are left (or with a
   * steer), the first ones of a new request. Throws an HttpError (French): see writeBatch.
   */
  async next(userId: string, options: NextIdeasOptions = {}): Promise<{ ideas: SaasIdea[]; fromStock: boolean }> {
    if (!options.steer?.trim()) {
      const fromStock = await this.revealFromStock(userId);
      if (fromStock) return { ideas: fromStock, fromStock: true };
    }
    return { ideas: await this.writeBatch(userId, options), fromStock: false };
  }

  /**
   * Shows the next series of the member's latest written request, if it has ideas left; null
   * otherwise. Counted with a compare-and-set, so two clicks at once cannot skip a series.
   */
  private async revealFromStock(userId: string): Promise<SaasIdea[] | null> {
    const { data: batch, error } = await this.db
      .from("saas_idea_batches")
      .select("id, revealed")
      .eq("user_id", userId)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!batch) return null;

    const { count, error: countError } = await this.db
      .from("saas_ideas")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id);
    if (countError) throw countError;
    if (batch.revealed >= (count ?? 0)) return null;

    const revealed = Math.min(batch.revealed + IDEAS_PER_SERIES, count ?? 0);
    const { data: claimed, error: claimError } = await this.db
      .from("saas_idea_batches")
      .update({ revealed })
      .eq("id", batch.id)
      .eq("revealed", batch.revealed)
      .select("id");
    if (claimError) throw claimError;
    if (!claimed?.length) throw new HttpError(409, "Gus te montre déjà de nouvelles idées.");

    const { data: ideas, error: ideasError } = await this.db
      .from("saas_ideas")
      .select(SAAS_IDEA_COLUMNS)
      .eq("batch_id", batch.id)
      .gte("position", batch.revealed)
      .lt("position", revealed)
      .order("position");
    if (ideasError) throw ideasError;
    return ideas as SaasIdea[];
  }

  /**
   * Writes a new request of ideas and returns its first series (about a minute). Throws an HttpError
   * (French) when the pipeline is missing, another request of the member is running (409), the daily
   * quota is used (429) or the model fails (502); a failed request does not count in the quota.
   */
  private async writeBatch(userId: string, { profile, steer }: NextIdeasOptions = {}): Promise<SaasIdea[]> {
    const pipeline = await this.pipeline();
    const steerText = steer?.trim() || null;
    const batchId = await this.claimBatch(userId, steerText);

    try {
      const [member, seen] = await Promise.all([this.memberProfile(userId, profile), this.seenIdeas(userId)]);
      const variables: Record<IdeasTemplateVariable, string> = {
        input: formatOnboardingProfile(member.profile),
        prenom: member.firstName,
        envie: steerText ?? "aucune précision",
        deja_vues: seen,
        nombre: String(IDEAS_PER_REQUEST),
      };

      const { jobId, json } = await this.oneshot.generateJson({
        model: pipeline.model,
        messages: buildIdeasMessages(pipeline, variables),
        responseSchema: ideasResponseSchema(IDEAS_PER_REQUEST),
      });
      const result = ideasAiResultSchema.safeParse(json);
      if (!result.success) {
        logger.error({ jobId, issues: result.error.issues }, "Ideas AI answer does not match the expected schema");
        throw new HttpError(502, "Gus n'a pas réussi à formuler ses idées. Réessaie.");
      }

      const rows = toIdeaContents(result.data).map((content, position) => ({ user_id: userId, batch_id: batchId, position, content }));
      const { data: ideas, error } = await this.db.from("saas_ideas").insert(rows).select(SAAS_IDEA_COLUMNS);
      if (error) throw error;

      // Written and its first series shown, in one update: the page never sees one without the other.
      const firstSeries = Math.min(IDEAS_PER_SERIES, rows.length);
      await this.setBatchStatus(batchId, "succeeded", firstSeries);
      return (ideas as SaasIdea[]).filter((idea) => idea.position < firstSeries).sort((a, b) => a.position - b.position);
    } catch (err) {
      await this.setBatchStatus(batchId, "failed");
      if (err instanceof HttpError) throw err;
      logger.error({ err, batchId }, "SaaS ideas generation failed");
      throw new HttpError(502, "Gus n'a pas réussi à trouver tes idées. Réessaie dans un instant.");
    }
  }

  /**
   * A new member's first ideas, started by the Whop webhook right after the payment: only for a
   * member without any SaaS nor ideas yet. Never throws (the webhook has nothing to do with a failure:
   * /lancement then asks again).
   */
  async startWelcomeIdeas(userId: string): Promise<void> {
    try {
      const [saas, batches] = await Promise.all([
        this.db.from("saas").select("id", { count: "exact", head: true }).eq("user_id", userId),
        this.db.from("saas_idea_batches").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "failed"),
      ]);
      if (saas.error || batches.error) throw saas.error ?? batches.error;
      if ((saas.count ?? 0) > 0 || (batches.count ?? 0) > 0) return;

      await this.writeBatch(userId);
      logger.info({ userId }, "Welcome SaaS ideas written");
    } catch (err) {
      // 409: the page asked first, its series is being written.
      if (err instanceof HttpError && err.status === 409) return;
      logger.error({ err, userId }, "Failed to write the welcome SaaS ideas");
    }
  }

  private async pipeline(): Promise<AiPipelineUpdate> {
    try {
      return await new AiPipelineRepository(this.db).get(AI_PIPELINE_SLUGS.ideas);
    } catch (err) {
      if (err instanceof AiPipelineNotFoundError) {
        logger.error({ err }, "Ideas pipeline missing: run section 7 of supabase_setup.sql");
        throw new HttpError(503, "Les idées ne sont pas encore configurées sur ce serveur.");
      }
      throw err;
    }
  }

  /** Batches that count over the last 24 hours (running or succeeded), oldest first. */
  private async countedBatches(userId: string) {
    const { data, error } = await this.db
      .from("saas_idea_batches")
      .select("id, created_at")
      .eq("user_id", userId)
      .neq("status", "failed")
      .gte("created_at", new Date(Date.now() - DAY_MS).toISOString())
      .order("created_at");
    if (error) throw error;
    return data;
  }

  /**
   * Starts a batch: records it first, then checks, so that concurrent requests cannot pass together.
   * Only the oldest batch still running goes on, within the daily quota; otherwise the new one is
   * removed and the request refused.
   */
  private async claimBatch(userId: string, steer: string | null): Promise<string> {
    const { data: claimed, error } = await this.db
      .from("saas_idea_batches")
      .insert({ user_id: userId, steer })
      .select("id")
      .single();
    if (error) throw error;

    const release = () => this.db.from("saas_idea_batches").delete().eq("id", claimed.id);

    const { data: running, error: runningError } = await this.db
      .from("saas_idea_batches")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "running")
      .gte("created_at", new Date(Date.now() - IDEA_BATCH_RUNNING_AT_MOST_MS).toISOString())
      .order("created_at")
      .order("id")
      .limit(1);
    if (runningError) {
      await release();
      throw runningError;
    }
    if (running[0] && running[0].id !== claimed.id) {
      await release();
      throw new HttpError(409, "Gus est déjà en train de chercher tes idées. Patiente quelques secondes.");
    }

    const batches = await this.countedBatches(userId);
    if (batches.length > IDEA_BATCHES_PER_DAY) {
      await release();
      const others = batches.filter((batch) => batch.id !== claimed.id);
      const freedAt = new Date(new Date(others[others.length - IDEA_BATCHES_PER_DAY].created_at).getTime() + DAY_MS);
      throw new HttpError(
        429,
        `Tu as demandé ${IDEA_BATCHES_PER_DAY} séries d'idées sur les dernières 24 h : prochaine série possible à ${parisTime.format(freedAt)}.`,
      );
    }
    return claimed.id;
  }

  /** Ideas already proposed to the member, newest first, for the model not to repeat them. */
  private async seenIdeas(userId: string): Promise<string> {
    const { data, error } = await this.db
      .from("saas_ideas")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("position")
      .limit(IDEAS_SEEN_IN_PROMPT);
    if (error) throw error;
    const lines = (data as { content: Partial<IdeaContent> }[])
      .filter(({ content }) => content?.name)
      .map(({ content }) => `- ${content.name} : ${content.pitch ?? ""}`.trim());
    return lines.length ? lines.join("\n") : "Aucune.";
  }

  /**
   * The member's onboarding answers: the ones sent from their device are saved first; without them,
   * the ones saved earlier (from the paywall, or another device).
   */
  private async memberProfile(userId: string, sent: OnboardingProfile | undefined) {
    if (sent?.length) {
      const { error } = await this.db.from("profiles").update({ onboarding_profile: sent }).eq("id", userId);
      if (error) logger.error({ err: error }, "Failed to save the onboarding profile");
    }
    const { data, error } = await this.db.from("profiles").select("full_name, onboarding_profile").eq("id", userId).maybeSingle();
    if (error) throw error;
    const saved = onboardingProfileSchema.safeParse(data?.onboarding_profile);
    return {
      firstName: (data?.full_name ?? "").trim().split(/\s+/)[0] || "inconnu",
      profile: sent?.length ? sent : saved.success ? saved.data : null,
    };
  }

  private async setBatchStatus(batchId: string, status: "succeeded" | "failed", revealed = 0) {
    const { error } = await this.db.from("saas_idea_batches").update({ status, revealed }).eq("id", batchId);
    if (error) logger.error({ err: error, batchId }, "Failed to update an idea batch");
  }
}

let service: IdeasService | null | undefined;

/** The service, or null when OneShotAPI or Supabase is not configured (the routes then answer 503). */
export function getIdeasService(): IdeasService | null {
  if (service === undefined) {
    // ONESHOTAPI_KEY: name used by some existing .env files (as for the coach).
    const apiKey = process.env.ONESHOT_API_KEY || process.env.ONESHOTAPI_KEY;
    service = apiKey && supabaseAdmin ? new IdeasService(supabaseAdmin, new OneShotClient(apiKey, { jobTimeoutMs: 3 * MINUTE_MS })) : null;
    if (!service) logger.warn("ONESHOT_API_KEY or Supabase missing: SaaS ideas answer 503");
  }
  return service;
}
