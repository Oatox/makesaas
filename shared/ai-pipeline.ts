import { z } from "zod";
import { IDEA_TEXT_LIMITS } from "./ideas";

/**
 * AI pipelines: admin-editable prompt sets stored in public.ai_pipelines, run through
 * OneShotAPI. A pipeline sends 4 messages to the model, in this order:
 *   system → user 1 (data) → user 2 (instructions) → user 3 (expected output format).
 * OneShotAPI manages sampling parameters itself (no temperature), so a pipeline only
 * chooses its model.
 *
 * To add a pipeline: add its slug here, its default row in supabase_setup.sql (section 7),
 * its editor config in client/src/components/admin/pipeline/pipeline-steps.ts and a server route
 * that runs it (see server/coach/routes.ts).
 */

export const AI_PIPELINE_SLUGS = { coach: "coach", carousel: "carousel", ideas: "ideas" } as const;
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

/**
 * Placeholders of the coach pipeline (Gus, server/coach/). Its system, instructions and format
 * prompts make the system message; `input` (the member's message) only exists in the data prompt,
 * which every message of the member goes through.
 */
export const COACH_TEMPLATE_VARIABLES = {
  prenom: "Prénom du membre (« inconnu » s'il ne l'a pas donné)",
  saas: "Nom du SaaS actif",
  date: "Date du jour",
  profil: "Le membre : ses réponses au questionnaire, son objectif de revenu, ses autres SaaS",
  projet: "Son SaaS actif : nom, description, cible, adresse de l'app et l'idée gardée",
  roadmap: "Sa roadmap : les étapes, l'étape en cours mission par mission, le tutoriel de sa prochaine mission",
  chiffres: "Ses chiffres réels : revenus (MRR, abonnés, paiements), comptes et vidéos TikTok, carrousels",
  input: "Message du membre (étape Message uniquement)",
} as const;
export type CoachTemplateVariable = keyof typeof COACH_TEMPLATE_VARIABLES;

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

// ---- Carousel pipeline (server/content/): the text of a generated carousel ----

/**
 * Placeholders of the carousel pipeline, a JSON job: its 4 prompts are sent in order (system, data,
 * instructions, format). Each slide's `imagePrompt` then goes to Nano Banana 2 (CAROUSEL_IMAGE_MODEL
 * in shared/carousel.ts), which is also told to draw no text: the text is laid over the images.
 */
export const CAROUSEL_TEMPLATE_VARIABLES = {
  input: "Sujet du carrousel donné par le membre",
  saas: "Nom du SaaS actif",
  slides: "Nombre de slides demandé",
  format: "Format des slides (ex. « vertical 9:16 »)",
} as const;
export type CarouselTemplateVariable = keyof typeof CAROUSEL_TEMPLATE_VARIABLES;

/** Lengths the model is held to: longer texts would not fit on a slide. */
export const CAROUSEL_TEXT_LIMITS = { title: 80, headline: 90, body: 220, imagePrompt: 1500 } as const;

/** What the carousel pipeline must return (validated by the server, beyond the enforced schema). */
export const carouselAiResultSchema = z.object({
  title: z.string().trim().min(1),
  slides: z
    .array(
      z.object({
        headline: z.string().trim().min(1),
        body: z.string().trim(),
        imagePrompt: z.string().trim().min(1),
      }),
    )
    .min(1),
});
export type CarouselAiResult = z.infer<typeof carouselAiResultSchema>;

/**
 * Same shape as carouselAiResultSchema, as the JSON Schema subset OneShotAPI enforces on Gemini,
 * for exactly `slideCount` slides. Keep both in sync.
 */
export function carouselResponseSchema(slideCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "slides"],
    properties: {
      title: { type: "string", description: `Titre court du carrousel, ${CAROUSEL_TEXT_LIMITS.title} caractères maximum` },
      slides: {
        type: "array",
        minItems: slideCount,
        maxItems: slideCount,
        description: "Les slides, dans l'ordre de lecture",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["headline", "body", "imagePrompt"],
          properties: {
            headline: { type: "string", description: `Texte principal, ${CAROUSEL_TEXT_LIMITS.headline} caractères maximum` },
            body: { type: "string", description: `Texte secondaire, ${CAROUSEL_TEXT_LIMITS.body} caractères maximum, vide si inutile` },
            imagePrompt: { type: "string", description: "Description de l'image de fond, sans aucun texte dans l'image" },
          },
        },
      },
    },
  } as const;
}

// ---- Ideas pipeline (server/ideas/): the SaaS ideas proposed on /lancement ----

/**
 * Placeholders of the ideas pipeline, a JSON job: its 4 prompts are sent in order (system, data,
 * instructions, format). It writes IDEAS_PER_REQUEST ideas ranked from the one Gus recommends most,
 * shown IDEAS_PER_SERIES at a time in that order (shared/ideas.ts).
 */
export const IDEAS_TEMPLATE_VARIABLES = {
  input: "Profil du membre : ses réponses au questionnaire",
  prenom: "Prénom du membre (« inconnu » s'il ne l'a pas donné)",
  envie: "Ce que le membre a précisé pour orienter ces idées (« aucune précision » sinon)",
  deja_vues: "Idées déjà proposées au membre, à ne pas reproposer",
  nombre: "Nombre d'idées à écrire (montrées 3 par 3, dans l'ordre)",
} as const;
export type IdeasTemplateVariable = keyof typeof IDEAS_TEMPLATE_VARIABLES;

/** What the ideas pipeline must return (lengths are cut by the server, prices rounded). */
export const ideasAiResultSchema = z.object({
  ideas: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        pitch: z.string().trim().min(1),
        problem: z.string().trim().min(1),
        audience: z.string().trim().min(1),
        price: z.number().positive(),
        whyYou: z.string().trim().min(1),
      }),
    )
    .min(1),
});
export type IdeasAiResult = z.infer<typeof ideasAiResultSchema>;

/**
 * Same shape as ideasAiResultSchema, as the JSON Schema subset OneShotAPI enforces on Gemini, for
 * exactly `count` ideas. Keep both in sync.
 */
export function ideasResponseSchema(count: number) {
  const text = (description: string) => ({ type: "string", description });
  return {
    type: "object",
    additionalProperties: false,
    required: ["ideas"],
    properties: {
      ideas: {
        type: "array",
        minItems: count,
        maxItems: count,
        description: "Les idées, de la plus conseillée au membre à la moins conseillée",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "pitch", "problem", "audience", "price", "whyYou"],
          properties: {
            name: text(`Nom court de l'app, ${IDEA_TEXT_LIMITS.name} caractères maximum`),
            pitch: text(`Ce que fait l'app, une phrase courte, ${IDEA_TEXT_LIMITS.pitch} caractères maximum`),
            problem: text(`Le problème réglé, une phrase courte, ${IDEA_TEXT_LIMITS.problem} caractères maximum`),
            audience: text(`Pour qui, quelques mots, ${IDEA_TEXT_LIMITS.audience} caractères maximum`),
            price: { type: "number", description: "Prix mensuel conseillé de l'abonnement, en euros, nombre entier" },
            whyYou: text(`Pourquoi l'idée colle au membre, une phrase courte en le tutoyant, ${IDEA_TEXT_LIMITS.whyYou} caractères maximum`),
          },
        },
      },
    },
  } as const;
}
