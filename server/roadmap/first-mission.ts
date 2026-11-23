import { BASE44_URL } from "@shared/roadmap-missions";
import { buildLogoPrompt, type MissionProject } from "@shared/roadmap-prompts";

/**
 * The first mission of a new SaaS, "Mettre ton app en ligne": a discussion with Gus opened from
 * /lancement (or the roadmap). The roadmap starts with the app's style, so Gus first gives the prompt
 * for ChatGPT that draws its logo (shared/roadmap-prompts.ts); the build prompt
 * for Base44 comes next, from Gus (he knows the next mission's prompt) or from the roadmap. Written here,
 * not by the model: it must be right the first time. The member then goes on with Gus in that discussion.
 */

/** The opening of the discussion: the member's question, then Gus's answer with the prompts. */
export function firstMissionMessages(project: MissionProject): { question: string; answer: string } {
  return {
    question: `Comment je mets ${project.name} en ligne ?`,
    answer: [
      `Ta première mission : mettre **${project.name}** en ligne. On commence par son logo, pour qu'elle ait l'air d'une vraie app dès sa première version : ton app prendra ses couleurs. Ensuite, on la construit avec **[Base44](${BASE44_URL})**, sans écrire une ligne de code.`,
      "",
      "**Son logo.** Ouvre [ChatGPT](https://chatgpt.com) et colle ce prompt. Pas convaincu ? Demande-lui une autre version. Quand il te plaît, télécharge-le et ajoute-le à ton projet depuis ta roadmap :",
      "",
      "```",
      buildLogoPrompt(project),
      "```",
      "",
      "Quand ton logo est prêt, écris-moi ici : je te donne le message pour construire ton app avec Base44. Tu retrouves aussi chaque étape dans ta roadmap, avec son tutoriel.",
    ].join("\n"),
  };
}
