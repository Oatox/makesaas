import { describe, expect, test } from "bun:test";
import type { AiPipelineUpdate, IdeasAiResult } from "@shared/ai-pipeline";
import { IDEA_PRICE_RANGE, IDEA_TEXT_LIMITS, IDEAS_PER_REQUEST, IDEAS_PER_SERIES, revealedSeries, type SaasIdea } from "@shared/ideas";
import { formatOnboardingProfile } from "@shared/onboarding-profile";
import { buildIdeasMessages, toIdeaContents } from "./service";

const IDEA = {
  name: "Fitlo",
  pitch: "Un programme de musculation adapté à ton emploi du temps.",
  problem: "Les débutants abandonnent faute de programme clair.",
  audience: "Étudiants qui débutent la musculation",
  price: 9,
  whyYou: "Tu fais du sport et tu connais ce public.",
};

describe("toIdeaContents", () => {
  test("keeps a valid idea as is", () => {
    expect(toIdeaContents({ ideas: [IDEA] })).toEqual([IDEA]);
  });

  test("cuts long texts, rounds and bounds the price, keeps at most one batch", () => {
    const long: IdeasAiResult = {
      ideas: Array.from({ length: IDEAS_PER_REQUEST + 2 }, () => ({
        ...IDEA,
        pitch: "mot ".repeat(100),
        price: 1234.6,
      })),
    };
    const ideas = toIdeaContents(long);
    expect(ideas).toHaveLength(IDEAS_PER_REQUEST);
    expect(ideas[0].pitch.length).toBeLessThanOrEqual(IDEA_TEXT_LIMITS.pitch);
    expect(ideas[0].pitch.endsWith("…")).toBe(true);
    expect(ideas[0].price).toBe(IDEA_PRICE_RANGE.max);
    expect(toIdeaContents({ ideas: [{ ...IDEA, price: 0.2 }] })[0].price).toBe(IDEA_PRICE_RANGE.min);
  });
});

describe("buildIdeasMessages", () => {
  test("system, then data, instructions and format, with the variables filled", () => {
    const pipeline: AiPipelineUpdate = {
      model: "gemini-3.8-flash",
      system_prompt: "Tu es Gus. Membre : {{prenom}}.",
      data_prompt: "Profil :\n{{input}}\nEnvie : {{envie}}\nDéjà vues : {{deja_vues}}",
      instructions_prompt: "Propose {{nombre}} idées.",
      output_format_prompt: "JSON.",
    };
    const messages = buildIdeasMessages(pipeline, {
      input: formatOnboardingProfile([{ question: "Qu'est-ce qui te passionne ?", answer: "Le sport" }]),
      prenom: "Léa",
      envie: "aucune précision",
      deja_vues: "Aucune.",
      nombre: "3",
    });
    expect(messages).toEqual([
      { role: "system", content: "Tu es Gus. Membre : Léa." },
      { role: "user", content: "Profil :\n- Qu'est-ce qui te passionne ? → Le sport\nEnvie : aucune précision\nDéjà vues : Aucune." },
      { role: "user", content: "Propose 3 idées." },
      { role: "user", content: "JSON." },
    ]);
  });

  test("an empty profile says so", () => {
    expect(formatOnboardingProfile(null)).toBe("Le membre n'a pas répondu au questionnaire.");
  });
});

describe("revealedSeries", () => {
  const idea = (batch: string, position: number): SaasIdea => ({
    id: `${batch}-${position}`,
    batch_id: batch,
    position,
    content: { ...IDEA, name: `${batch}${position}` },
    created_at: batch === "old" ? "2026-11-23T10:00:00Z" : "2026-11-23T11:00:00Z",
  });
  const ideasOf = (batch: string) => Array.from({ length: IDEAS_PER_REQUEST }, (_, position) => idea(batch, position));

  test("only what each request revealed, in series, the newest first", () => {
    const series = revealedSeries(
      [
        { id: "old", revealed: IDEAS_PER_REQUEST, created_at: "2026-11-23T10:00:00Z" },
        { id: "new", revealed: 2 * IDEAS_PER_SERIES, created_at: "2026-11-23T11:00:00Z" },
      ],
      [...ideasOf("old"), ...ideasOf("new")].reverse(),
    );
    expect(series.map((s) => s.id)).toEqual(["new:1", "new:0", "old:3", "old:2", "old:1", "old:0"]);
    expect(series[0].ideas.map((i) => i.position)).toEqual([3, 4, 5]);
    expect(series.every((s) => s.ideas.length === IDEAS_PER_SERIES)).toBe(true);
  });

  test("a request not revealed yet shows nothing", () => {
    expect(revealedSeries([{ id: "new", revealed: 0, created_at: "2026-11-23T11:00:00Z" }], ideasOf("new"))).toEqual([]);
  });
});
