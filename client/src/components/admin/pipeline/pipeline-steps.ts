import {
  AI_PIPELINE_SLUGS,
  CAROUSEL_TEMPLATE_VARIABLES,
  COACH_TEMPLATE_VARIABLES,
  IDEAS_TEMPLATE_VARIABLES,
  carouselResponseSchema,
  ideasResponseSchema,
  type AiPipelineSlug,
  type AiPipelineUpdate,
} from "@shared/ai-pipeline";
import { CAROUSEL_GENERATED_SLIDES, CAROUSEL_IMAGE_MODEL, carouselImageRules } from "@shared/carousel";
import { COACH_HISTORY_MESSAGES } from "@shared/coach";
import { IDEAS_PER_REQUEST, IDEAS_PER_SERIES } from "@shared/ideas";

export type PromptFieldName = Exclude<keyof AiPipelineUpdate, "model">;

export type PipelineStep = {
  field: PromptFieldName;
  role: "system" | "user";
  /** Short name, in the outline and above the editor. */
  label: string;
  /** One line: what this prompt is for. */
  hint: string;
  /** Longer explanation shown above the editor. */
  description: string;
  /** The variables this prompt can use (the server fills only these in it). */
  variables: string[];
};

/** A part of what the model receives that the app writes itself: shown read-only. */
export type FixedStep = {
  id: string;
  label: string;
  hint: string;
  description: string;
  /** The model it goes to, when it is not the pipeline's. */
  model?: string;
  content: string;
};

/** One stage of what is sent, in order: built from prompts (clickable) or added by the app. */
export type FlowStage = {
  label: string;
  detail: string;
  /** The prompts this stage is made of; none: the app adds it. */
  fields?: PromptFieldName[];
  /** The read-only step that shows it. */
  fixedStep?: string;
};

/**
 * The member's journey (AGENTS.md, "User journey"), in order: the list of pipelines shows where it
 * calls the AI, and says so for the stages that do not.
 */
export const JOURNEY_STAGES = [
  { id: "onboarding", label: "Onboarding", paths: "/onboarding" },
  { id: "signup", label: "Inscription et paiement", paths: "/register · /abonnement" },
  { id: "launch", label: "Lancement", paths: "/lancement" },
  { id: "app", label: "Application", paths: "/dash · /acquisition · /discussions" },
] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number]["id"];

export type PipelineConfig = {
  slug: AiPipelineSlug;
  label: string;
  /** Where in the member's journey the app runs it ("app" when unset). */
  stage?: JourneyStage;
  /** The screen that runs it, in a few words (on its card). */
  page: string;
  /** Where the app runs it, in a sentence (on its page). */
  usedIn: string;
  /** The editable prompts, in the order the model receives them. */
  steps: PipelineStep[];
  /** What the app adds around the prompts, read-only, after the editable steps. */
  fixedSteps: FixedStep[];
  flow: FlowStage[];
  variables: Record<string, string>;
  /** JSON schema the app enforces on the answer, shown read-only under the format step. */
  responseSchema: object | null;
};

const COACH_SYSTEM_VARIABLES = ["prenom", "saas", "date", "profil", "projet", "roadmap", "chiffres"];
const CAROUSEL_VARIABLES = Object.keys(CAROUSEL_TEMPLATE_VARIABLES);

/**
 * The coach (Gus, /discussions): a chat, not a JSON job. Personality, instructions and format make
 * one system message; every message of the member then goes through the Message prompt.
 */
const COACH: PipelineConfig = {
  slug: AI_PIPELINE_SLUGS.coach,
  label: "Coach Gus",
  stage: "app",
  page: "Discussions",
  usedIn: "Discussions avec Gus (/discussions)",
  variables: COACH_TEMPLATE_VARIABLES,
  responseSchema: null,
  steps: [
    {
      field: "system_prompt",
      role: "system",
      label: "Personnalité",
      hint: "Qui est Gus",
      description: "Qui est Gus, son ton, ses limites et le contexte du membre. Début du message système de chaque discussion.",
      variables: COACH_SYSTEM_VARIABLES,
    },
    {
      field: "instructions_prompt",
      role: "system",
      label: "Consignes",
      hint: "Comment il répond",
      description: "Sa méthode de coaching : ce qu'il fait à chaque réponse. Ajouté au message système, après la personnalité.",
      variables: COACH_SYSTEM_VARIABLES,
    },
    {
      field: "output_format_prompt",
      role: "system",
      label: "Format",
      hint: "Forme des réponses",
      description:
        "Longueur et mise en forme des réponses. Ajouté à la fin du message système. L'application affiche le gras, les listes et les liens Markdown, rien d'autre.",
      variables: COACH_SYSTEM_VARIABLES,
    },
    {
      field: "data_prompt",
      role: "user",
      label: "Message",
      hint: "Chaque message du membre",
      description:
        "Ce que Gus reçoit pour chaque message du membre, dans l'historique de la discussion. Doit contenir {{input}}, remplacé par le message.",
      variables: [...COACH_SYSTEM_VARIABLES, "input"],
    },
  ],
  fixedSteps: [],
  flow: [
    {
      label: "Message système",
      detail: "Les trois prompts mis bout à bout",
      fields: ["system_prompt", "instructions_prompt", "output_format_prompt"],
    },
    {
      label: "Historique",
      detail: `Les ${COACH_HISTORY_MESSAGES} derniers messages, chaque message du membre passé par l'étape Message`,
      fields: ["data_prompt"],
    },
    { label: "Réponse de Gus", detail: "Écrite au fil de l'eau, enregistrée dans la discussion" },
  ],
};

/**
 * Generated carousels (/acquisition/contenu): a JSON job, its 4 messages sent in this order. The
 * image of each slide is then drawn by the image model from the slide's imagePrompt.
 */
const CAROUSEL: PipelineConfig = {
  slug: AI_PIPELINE_SLUGS.carousel,
  label: "Carrousels",
  stage: "app",
  page: "Acquisition → Création de contenu",
  usedIn: "Génération de carrousels (Acquisition → Création de contenu)",
  variables: CAROUSEL_TEMPLATE_VARIABLES,
  responseSchema: carouselResponseSchema(CAROUSEL_GENERATED_SLIDES.default),
  steps: [
    {
      field: "system_prompt",
      role: "system",
      label: "Système",
      hint: "Rôle et règles",
      description: "Qui est l'IA, son ton et ses règles pour écrire les carrousels.",
      variables: CAROUSEL_VARIABLES,
    },
    {
      field: "data_prompt",
      role: "user",
      label: "Données",
      hint: "Le sujet et le SaaS",
      description: "Ce que le membre demande. Doit contenir {{input}}, remplacé par le sujet du carrousel.",
      variables: CAROUSEL_VARIABLES,
    },
    {
      field: "instructions_prompt",
      role: "user",
      label: "Consignes",
      hint: "Structure et images",
      description:
        "La structure du carrousel (accroche, idées, appel à l'action) et la façon de décrire les images. Les images ne doivent contenir aucun texte : il est posé par-dessus et reste modifiable.",
      variables: CAROUSEL_VARIABLES,
    },
    {
      field: "output_format_prompt",
      role: "user",
      label: "Format",
      hint: "Structure de la réponse",
      description:
        "Décrit le JSON attendu. La réponse est de toute façon contrainte par le schéma de l'application (plus bas, ici pour 6 slides) : gardez les deux cohérents.",
      variables: CAROUSEL_VARIABLES,
    },
  ],
  fixedSteps: [
    {
      id: "image",
      label: "Images",
      hint: "Ajouté à chaque image",
      model: CAROUSEL_IMAGE_MODEL,
      description:
        "Le modèle d'images reçoit l'imagePrompt de chaque slide, écrit par l'IA, suivi de ces règles fixes de l'application. Elles interdisent le texte dans l'image : il est posé par-dessus et reste modifiable.",
      content: `{imagePrompt de la slide}\n\n${carouselImageRules("{Format} {ratio}")}`,
    },
  ],
  flow: [
    { label: "Système", detail: "Rôle et règles", fields: ["system_prompt"] },
    { label: "Demande", detail: "Sujet, consignes et format, trois messages", fields: ["data_prompt", "instructions_prompt", "output_format_prompt"] },
    { label: "Réponse JSON", detail: "Titre et slides, contraints par le schéma de l'application" },
    { label: "Images", detail: `Une par slide, par ${CAROUSEL_IMAGE_MODEL}`, fixedStep: "image" },
  ],
};

/**
 * SaaS ideas (/lancement): a JSON job, its 4 messages sent in this order. The first idea returned is
 * the one Gus recommends to the member.
 */
const IDEAS_VARIABLES = Object.keys(IDEAS_TEMPLATE_VARIABLES);
const IDEAS: PipelineConfig = {
  slug: AI_PIPELINE_SLUGS.ideas,
  label: "Idées de SaaS",
  stage: "launch",
  page: "Choix de l'idée",
  usedIn: "Les idées proposées après le paiement (/lancement)",
  variables: IDEAS_TEMPLATE_VARIABLES,
  responseSchema: ideasResponseSchema(IDEAS_PER_REQUEST),
  steps: [
    {
      field: "system_prompt",
      role: "system",
      label: "Système",
      hint: "Rôle et règles",
      description: "Qui est l'IA et ses règles pour proposer des idées, dont ce qu'elle ne doit jamais inventer.",
      variables: IDEAS_VARIABLES,
    },
    {
      field: "data_prompt",
      role: "user",
      label: "Données",
      hint: "Le profil du membre",
      description:
        "Ce que l'IA sait du membre : ses réponses au questionnaire ({{input}}, obligatoire), ce qu'il a précisé et les idées déjà proposées, à ne pas répéter.",
      variables: IDEAS_VARIABLES,
    },
    {
      field: "instructions_prompt",
      role: "user",
      label: "Consignes",
      hint: "Quelles idées proposer",
      description:
        "Le type d'apps à proposer, ce qu'il faut éviter et ce que dit chaque champ d'une idée. La première idée est celle que Gus conseille.",
      variables: IDEAS_VARIABLES,
    },
    {
      field: "output_format_prompt",
      role: "user",
      label: "Format",
      hint: "Structure de la réponse",
      description:
        "Décrit le JSON attendu. La réponse est de toute façon contrainte par le schéma de l'application (plus bas) : gardez les deux cohérents.",
      variables: IDEAS_VARIABLES,
    },
  ],
  fixedSteps: [],
  flow: [
    { label: "Système", detail: "Rôle et règles", fields: ["system_prompt"] },
    { label: "Demande", detail: "Profil du membre, consignes et format, trois messages", fields: ["data_prompt", "instructions_prompt", "output_format_prompt"] },
    { label: "Réponse JSON", detail: `${IDEAS_PER_REQUEST} idées classées, montrées ${IDEAS_PER_SERIES} par ${IDEAS_PER_SERIES}` },
  ],
};

/** One entry per pipeline of shared/ai-pipeline.ts. */
export const PIPELINE_CONFIGS: PipelineConfig[] = [COACH, CAROUSEL, IDEAS];

export const getPipelineConfig = (slug: string) => PIPELINE_CONFIGS.find((config) => config.slug === slug);

/** Page of a pipeline's prompts. */
export const pipelinePath = (slug: AiPipelineSlug) => `/admin/pipeline/${slug}`;

/** DOM id of a prompt's section, the target of the flow's links. */
export const sectionId = (slug: AiPipelineSlug, step: string) => `pipeline-${slug}-${step}`;
