import type { Express } from "express";
import {
  AI_EXAMPLE_RESPONSE_SCHEMA,
  AI_PIPELINE_SLUGS,
  aiApi,
  aiExampleBodySchema,
  aiExampleResultSchema,
  type AiPipelineUpdate,
} from "@shared/ai-pipeline";
import { requireSubscriber } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { OneShotClient, OneShotError, type ChatMessage } from "./oneshot-client";
import { AiPipelineNotFoundError, AiPipelineRepository, renderTemplate } from "./pipelines";

/** The 4 pipeline messages, in the order the model receives them, with {{variables}} filled in. */
export function buildPipelineMessages(pipeline: AiPipelineUpdate, variables: Record<string, string>): ChatMessage[] {
  return [
    { role: "system", content: renderTemplate(pipeline.system_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.data_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.instructions_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.output_format_prompt, variables) },
  ];
}

/** Example AI route: copy it for each real pipeline of the product. */
export function registerAiRoutes(app: Express) {
  const apiKey = process.env.ONESHOT_API_KEY;
  const oneshot = apiKey ? new OneShotClient(apiKey) : null;
  if (!oneshot) logger.warn("ONESHOT_API_KEY missing: AI routes answer 503");

  app.post(
    aiApi.example.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      if (!oneshot) throw new HttpError(503, "L'IA n'est pas configurée sur ce serveur.");
      const { input } = parseInput(aiExampleBodySchema, req.body);

      // requireSubscriber answers 503 when Supabase is not configured, so the client is set here.
      let pipeline: AiPipelineUpdate;
      try {
        pipeline = await new AiPipelineRepository(supabaseAdmin!).get(AI_PIPELINE_SLUGS.example);
      } catch (err) {
        if (err instanceof AiPipelineNotFoundError) {
          logger.error({ err }, "AI pipeline missing");
          throw new HttpError(503, "L'IA n'est pas configurée : pipeline introuvable.");
        }
        throw err;
      }

      try {
        const { jobId, json } = await oneshot.generateJson({
          model: pipeline.model,
          messages: buildPipelineMessages(pipeline, { input }),
          responseSchema: AI_EXAMPLE_RESPONSE_SCHEMA,
        });

        const result = aiExampleResultSchema.safeParse(json);
        if (!result.success) {
          logger.error({ jobId, issues: result.error.issues }, "AI answer does not match the expected schema");
          throw new HttpError(502, "L'IA a renvoyé une réponse invalide, réessayez.");
        }
        res.json(result.data);
      } catch (err) {
        if (err instanceof OneShotError) {
          logger.error({ err }, "AI generation failed");
          throw new HttpError(502, "L'IA est momentanément indisponible, réessayez dans un instant.");
        }
        throw err;
      }
    }),
  );
}
