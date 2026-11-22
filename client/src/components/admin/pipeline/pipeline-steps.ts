import {
  AI_EXAMPLE_RESPONSE_SCHEMA,
  AI_PIPELINE_SLUGS,
  EXAMPLE_TEMPLATE_VARIABLES,
  type AiPipelineSlug,
  type AiPipelineUpdate,
} from "@shared/ai-pipeline";

export type PromptFieldName = Exclude<keyof AiPipelineUpdate, "model">;

export type PipelineStep = {
  field: PromptFieldName;
  role: "system" | "user";
  /** Short name in the step bar. */
  label: string;
  /** One-line hint under the step label. */
  hint: string;
  /** Longer explanation shown above the editor. */
  description: string;
  showVariables: boolean;
};

/** The 4 messages of the example pipeline, in the order they are sent to the model. */
const EXAMPLE_STEPS: PipelineStep[] = [
  {
    field: "system_prompt",
    role: "system",
    label: "Système",
    hint: "Rôle et règles",
    description: "Qui est l'IA, son ton et ses règles de conduite. S'applique à toute la conversation.",
    showVariables: false,
  },
  {
    field: "data_prompt",
    role: "user",
    label: "Données",
    hint: "Ce qu'on lui fournit",
    description: "Les données envoyées à l'IA. Doit contenir {{input}}, remplacé par le texte envoyé par l'utilisateur.",
    showVariables: true,
  },
  {
    field: "instructions_prompt",
    role: "user",
    label: "Consignes",
    hint: "Ce qu'elle doit faire",
    description: "Les étapes du traitement, les points à couvrir et le niveau de détail attendu.",
    showVariables: true,
  },
  {
    field: "output_format_prompt",
    role: "user",
    label: "Format",
    hint: "Structure de la réponse",
    description:
      "Décrit le JSON attendu. La réponse est de toute façon contrainte et validée par le schéma de l'application (voir plus bas) : gardez les deux cohérents.",
    showVariables: false,
  },
];

export type PipelineConfig = {
  slug: AiPipelineSlug;
  label: string;
  hint: string;
  steps: PipelineStep[];
  variables: Record<string, string>;
  /** JSON schema the app enforces on the answer, shown read-only under the format step. */
  responseSchema: object | null;
};

/** One entry per pipeline of shared/ai-pipeline.ts; the editor shows a selector when there are several. */
export const PIPELINE_CONFIGS: PipelineConfig[] = [
  {
    slug: AI_PIPELINE_SLUGS.example,
    label: "Exemple",
    hint: "Résumé d'un texte en points clés",
    steps: EXAMPLE_STEPS,
    variables: EXAMPLE_TEMPLATE_VARIABLES,
    responseSchema: AI_EXAMPLE_RESPONSE_SCHEMA,
  },
];
