import { z } from "zod";

/**
 * AI pipelines: admin-editable prompt sets stored in public.ai_pipelines, run through
 * OneShotAPI. A pipeline sends 4 messages to the model, in this order:
 *   system → user 1 (data) → user 2 (instructions) → user 3 (expected output format).
 * OneShotAPI manages sampling parameters itself (no temperature), so a pipeline only
 * chooses its model.
 *
 * To add a pipeline: add its slug here, its default row in supabase_setup.sql (section 9),
 * its editor config in client/src/components/admin/pipeline/pipeline-steps.ts and a server route
 * that runs it (see server/ai/routes.ts).
 */

export const AI_PIPELINE_SLUGS = { example: "example" } as const;
export type AiPipelineSlug = (typeof AI_PIPELINE_SLUGS)[keyof typeof AI_PIPELINE_SLUGS];

/** OneShotAPI Gemini text models: the only ones supporting enforced JSON schema output. */
export const AI_TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
] as const;
export type AiTextModel = (typeof AI_TEXT_MODELS)[number];
export const DEFAULT_AI_MODEL: AiTextModel = "gemini-3.8-flash";

export const PROMPT_MAX_LENGTH = 20_000;

/** Placeholders the server replaces in every prompt of the example pipeline. `input` is mandatory in user 1. */
export const EXAMPLE_TEMPLATE_VARIABLES = {
  input: "Texte envoyé par l'utilisateur",
} as const;
export type ExampleTemplateVariable = keyof typeof EXAMPLE_TEMPLATE_VARIABLES;

export const REQUIRED_DATA_PLACEHOLDER = "{{input}}";

const promptField = z.string().trim().min(1, "Ce prompt ne peut pas être vide").max(PROMPT_MAX_LENGTH);

/** Fields an admin can edit from the Pipeline page. */
export const aiPipelineUpdateSchema = z.object({
  model: z.enum(AI_TEXT_MODELS, { errorMap: () => ({ message: "Modèle non pris en charge" }) }),
  system_prompt: promptField,
  data_prompt: promptField.refine((value) => value.includes(REQUIRED_DATA_PLACEHOLDER), {
    message: `Le prompt de données doit contenir ${REQUIRED_DATA_PLACEHOLDER}`,
  }),
  instructions_prompt: promptField,
  output_format_prompt: promptField,
});
export type AiPipelineUpdate = z.infer<typeof aiPipelineUpdateSchema>;

/** Row of public.ai_pipelines. */
export type AiPipeline = AiPipelineUpdate & {
  slug: AiPipelineSlug;
  name: string;
  updated_at: string;
  updated_by: string | null;
};

// ---- Example pipeline: input and output ----

export const AI_INPUT_MAX_LENGTH = 4_000;

export const aiExampleBodySchema = z.object({
  input: z.string().trim().min(1, "Le texte est vide").max(AI_INPUT_MAX_LENGTH),
});
export type AiExampleBody = z.infer<typeof aiExampleBodySchema>;

/** What the example pipeline must return. The server validates the model's answer against it. */
export const aiExampleResultSchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1).max(5),
});
export type AiExampleResult = z.infer<typeof aiExampleResultSchema>;

/**
 * Same shape as aiExampleResultSchema, as the JSON Schema subset OneShotAPI enforces on
 * Gemini (`options.responseSchema`: no $ref, pattern or minLength). Keep both in sync.
 */
export const AI_EXAMPLE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "keyPoints"],
  properties: {
    summary: { type: "string", description: "Synthèse du texte en 2 phrases, 50 mots maximum" },
    keyPoints: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      description: "Les points clés du texte, une phrase courte chacun",
      items: { type: "string" },
    },
  },
} as const;

export const aiApi = {
  /** POST, subscribers only: runs the example pipeline on `input` and returns an AiExampleResult. */
  example: { path: "/api/ai/example" },
} as const;
