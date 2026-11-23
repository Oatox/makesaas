import { buildAppPrompt, type MissionProject } from "@shared/roadmap-prompts";

/**
 * The first mission of a new SaaS, "Mettre ton app en ligne": a discussion with Gus opened from
 * /lancement (or the roadmap), where Gus gives the member the prompt to build their app with Claude
 * (shared/roadmap-prompts.ts). Written here, not by the model: it must be right the first time. The
 * member then goes on with Gus in that discussion.
 */

/** The opening of the discussion: the member's question, then Gus's answer with the prompt. */
export function firstMissionMessages(project: MissionProject): { question: string; answer: string } {
  return {
    question: `Comment je mets ${project.name} en ligne ?`,
    answer: [
      `Ta première mission : mettre **${project.name}** en ligne. On la construit avec **Claude**, sans écrire une ligne de code.`,
      "",
      "1. Installe l'application **Claude** sur ton ordinateur ([claude.ai/download](https://claude.ai/download)) et prends l'abonnement **Pro**.",
      `2. Ouvre l'onglet **Code**, puis choisis un dossier vide pour ${project.name}.`,
      "3. Copie le prompt ci-dessous, colle-le dans Claude et envoie-le.",
      "",
      "```",
      buildAppPrompt(project),
      "```",
      "",
      "Claude va te poser quelques questions, écrire le plan de ton app, puis construire une première version que tu verras dans son aperçu. Elle n'a pas besoin d'être parfaite : le but, c'est qu'elle marche jusqu'à l'écran de résultat.",
      "",
      "Tu retrouves chaque étape dans ta roadmap, avec son tutoriel. Quand c'est fait, ou si quelque chose bloque, écris-moi ici : je te donne la suite.",
    ].join("\n"),
  };
}
