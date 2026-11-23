import { describe, expect, test } from "bun:test";
import type { AiPipelineUpdate } from "@shared/ai-pipeline";
import { COACH_TITLE_MAX_LENGTH, conversationTitleFrom } from "@shared/coach";
import { buildCoachMessages } from "./routes";

const PIPELINE: AiPipelineUpdate = {
  model: "gemini-3.8-flash",
  system_prompt: "Tu es Gus. Membre : {{prenom}}, SaaS : {{saas}}.",
  instructions_prompt: "Consignes du {{date}}.",
  output_format_prompt: "Format court.",
  data_prompt: "Message : {{input}}",
};
const VARIABLES = { prenom: "Léa", saas: "Facturo", date: "lundi 23 novembre 2026" };

describe("buildCoachMessages", () => {
  test("one system message, then each member message through the data prompt", () => {
    const messages = buildCoachMessages(PIPELINE, VARIABLES, [
      { role: "user", content: "Salut" },
      { role: "assistant", content: "Salut Léa !" },
      { role: "user", content: "Quel prix ?" },
    ]);
    expect(messages).toEqual([
      { role: "system", content: "Tu es Gus. Membre : Léa, SaaS : Facturo.\n\nConsignes du lundi 23 novembre 2026.\n\nFormat court." },
      { role: "user", content: "Message : Salut" },
      { role: "assistant", content: "Salut Léa !" },
      { role: "user", content: "Message : Quel prix ?" },
    ]);
  });

  test("merges consecutive messages of one author and starts with the member", () => {
    const messages = buildCoachMessages(PIPELINE, VARIABLES, [
      { role: "assistant", content: "Fin d'une réponse coupée par l'historique" },
      { role: "user", content: "Premier" },
      { role: "user", content: "Second, sans réponse entre les deux" },
    ]);
    expect(messages.slice(1)).toEqual([{ role: "user", content: "Message : Premier\n\nMessage : Second, sans réponse entre les deux" }]);
  });

  test("never fills placeholders typed by the member", () => {
    const messages = buildCoachMessages(PIPELINE, VARIABLES, [{ role: "user", content: "Que vaut {{saas}} ? $& $1" }]);
    expect(messages[1].content).toBe("Message : Que vaut {{saas}} ? $& $1");
  });
});

describe("conversationTitleFrom", () => {
  test("keeps a short message on one line", () => {
    expect(conversationTitleFrom("  Comment   trouver\nmes clients ?  ")).toBe("Comment trouver mes clients ?");
  });

  test("cuts a long message at a word, within the limit", () => {
    const title = conversationTitleFrom("mot ".repeat(60));
    expect(title.length).toBeLessThanOrEqual(COACH_TITLE_MAX_LENGTH);
    expect(title.endsWith("mot…")).toBe(true);
  });
});
