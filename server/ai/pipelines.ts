import type { SupabaseClient } from "@supabase/supabase-js";
import { aiPipelineUpdateSchema, type AiPipelineSlug, type AiPipelineUpdate } from "@shared/ai-pipeline";
import { logger } from "../lib/logger";

export class AiPipelineNotFoundError extends Error {
  constructor(readonly slug: AiPipelineSlug) {
    super(`AI pipeline "${slug}" is missing or invalid`);
    this.name = "AiPipelineNotFoundError";
  }
}

/** Reads pipelines on every run, so an admin edit applies to the very next run. */
export class AiPipelineRepository {
  constructor(private readonly db: SupabaseClient) {}

  async get(slug: AiPipelineSlug): Promise<AiPipelineUpdate> {
    const { data, error } = await this.db
      .from("ai_pipelines")
      .select("model, system_prompt, data_prompt, instructions_prompt, output_format_prompt")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      logger.error({ err: error, slug }, "Failed to load AI pipeline");
    }

    const parsed = aiPipelineUpdateSchema.safeParse(data);
    if (!parsed.success) {
      throw new AiPipelineNotFoundError(slug);
    }
    return parsed.data;
  }
}

/** Replaces {{name}} placeholders with known variables; unknown placeholders are left as is. */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, name: string) =>
    Object.hasOwn(variables, name) ? variables[name] : placeholder,
  );
}
