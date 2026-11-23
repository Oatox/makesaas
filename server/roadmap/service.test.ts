import { describe, expect, test } from "bun:test";
import { currentStageIndex, stageProgress } from "@shared/roadmap";
import { roadmapStagesFor } from "@shared/roadmap-missions";
import { buildAppPrompt, buildPaymentPrompt } from "@shared/roadmap-prompts";
import { firstMissionMessages } from "./first-mission";
import { observedMissions, type MissionFacts } from "./service";

const CREATED = "2026-11-20T10:00:00.000Z";
const NOW = "2026-11-23T15:00:00.000Z";
const STAGES = roadmapStagesFor(10_000);

/** A year of daily values from 2025-11-26 (day 359 is 2026-11-20), zero but on the days given. */
const series = (days: Record<number, number>, carry = false) => {
  const values: number[] = [];
  let last = 0;
  for (let day = 0; day < 365; day++) {
    if (days[day] !== undefined) last = days[day];
    values.push(days[day] ?? (carry ? last : 0));
  }
  return values;
};

const facts = (overrides: Partial<MissionFacts> = {}): MissionFacts => ({
  saasCreatedAt: CREATED,
  hasAppUrl: false,
  hasPaymentAccount: false,
  tiktokAccounts: 0,
  videoDates: [],
  revenue: null,
  rates: null,
  now: NOW,
  ...overrides,
});

describe("roadmapStagesFor", () => {
  test("the base stages, the MRR tiers under the goal, then the goal", () => {
    const keys = (goal: number) => roadmapStagesFor(goal).map((stage) => stage.key);
    expect(keys(5_000)).toEqual(["idea", "build", "payment", "video", "customer", "mrr_100", "mrr_1000", "mrr_2500", "mrr_5000"]);
    expect(keys(3_000).slice(-2)).toEqual(["mrr_2500", "mrr_3000"]);
    expect(roadmapStagesFor(3_000).at(-1)?.isGoal).toBe(true);
    // No goal (or a wrong one): 10 000 € by default.
    expect(keys(Number.NaN).at(-1)).toBe("mrr_10000");
  });

  test("every mission key is unique and says its stage", () => {
    for (const goal of [1_000, 10_000, 100_000]) {
      const stages = roadmapStagesFor(goal);
      const keys = stages.flatMap((stage) => stage.missions.map((mission) => mission.key));
      expect(new Set(keys).size).toBe(keys.length);
      for (const stage of stages) for (const mission of stage.missions) expect(mission.key.startsWith(`${stage.key}:`)).toBe(true);
    }
  });

  test("every MRR stage ends on its amount, checked from the data", () => {
    for (const stage of STAGES.filter((item) => item.mrr)) {
      expect(stage.missions.at(-1)?.check).toEqual({ kind: "mrr", amount: stage.mrr });
      expect(stage.missions.length).toBeGreaterThan(1);
    }
  });
});

describe("observedMissions", () => {
  test("a new SaaS: only its idea", () => {
    expect(observedMissions(facts(), STAGES)).toEqual({ "idea:chosen": { at: CREATED, source: "declared" } });
  });

  test("the address, the accounts and the videos, dated by the Nth video", () => {
    const videoDates = Array.from({ length: 7 }, (_, i) => `2026-11-${String(19 + i).padStart(2, "0")}T18:00:00.000Z`);
    const done = observedMissions(facts({ hasAppUrl: true, hasPaymentAccount: true, tiktokAccounts: 1, videoDates }), STAGES);
    expect(done["build:online"]).toEqual({ at: NOW, source: "declared" });
    expect(done["payment:connect"]).toEqual({ at: NOW, source: "observed" });
    expect(done["video:track"]?.source).toBe("observed");
    expect(done["video:posted"]).toEqual({ at: videoDates[0], source: "before" });
    expect(done["customer:7_videos"]).toEqual({ at: videoDates[6], source: "observed" });
    expect(done["mrr_100:30_videos"]).toBeUndefined();
    expect(done["mrr_1000:2_accounts"]).toBeUndefined();
    // Manual missions are only ticked by the member.
    expect(done["build:claude"]).toBeUndefined();
  });

  test("the first payment and the MRR, compared in euros", () => {
    const done = observedMissions(
      facts({
        revenue: { currency: "USD", seriesStart: "2025-11-26", revenue: series({ 360: 29 }), mrr: series({ 360: 105, 362: 1_200 }, true) },
        rates: { EUR: 1, USD: 1.1 },
      }),
      STAGES,
    );
    expect(done["customer:first_payment"]).toEqual({ at: "2026-11-21T12:00:00.000Z", source: "observed" });
    // 105 $ is less than 100 €; 1 200 $ is more.
    expect(done["mrr_100:reached"]?.at).toBe("2026-11-23T12:00:00.000Z");
    expect(done["mrr_1000:reached"]?.at).toBe("2026-11-23T12:00:00.000Z");
    expect(done["mrr_2500:reached"]).toBeUndefined();
  });
});

describe("stage progress", () => {
  test("a stage is done when all its missions are; the current one is the first not done", () => {
    const done = { "idea:chosen": { at: CREATED, source: "declared" as const }, "build:claude": { at: NOW, source: "declared" as const } };
    expect(stageProgress(STAGES[0], done)).toEqual({ done: 1, total: 1, complete: true });
    expect(stageProgress(STAGES[1], done)).toEqual({ done: 1, total: 3, complete: false });
    expect(currentStageIndex(STAGES, done)).toBe(1);
  });
});

describe("prompts", () => {
  const project = { name: "Fitlo", description: "Ton programme de muscu en 3 questions.", audience: "Étudiants", problem: "Pas de programme clair.", price: 9 };

  test("the build prompt carries the project and the steps for Claude", () => {
    const prompt = buildAppPrompt(project);
    expect(prompt).toContain("appelée Fitlo");
    expect(prompt).toContain("L'idée : Ton programme de muscu en 3 questions.");
    // Intl puts a narrow no-break space before the euro sign.
    expect(prompt).toMatch(/Un abonnement à 9\s€ par mois débloque la suite\./);
    expect(prompt).toContain("SPEC.md");
  });

  test("a SaaS created by its name only still gets prompts", () => {
    const bare = { name: "Fitlo", description: null, audience: null, problem: null, price: null };
    expect(buildAppPrompt(bare)).not.toContain("L'idée");
    expect(buildAppPrompt(bare)).toContain("Un abonnement mensuel débloque la suite.");
    expect(buildPaymentPrompt(bare)).toContain("un abonnement mensuel");
  });

  test("Gus's first mission holds the build prompt in a code block", () => {
    const { question, answer } = firstMissionMessages(project);
    expect(question).toBe("Comment je mets Fitlo en ligne ?");
    expect(answer).toContain("```\nJe veux créer une app web appelée Fitlo");
  });
});
