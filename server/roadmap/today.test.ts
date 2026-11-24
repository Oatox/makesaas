import { describe, expect, test } from "bun:test";
import type { MissionDone } from "@shared/roadmap";
import { milestonesFor, roadmapStagesFor } from "@shared/roadmap-missions";
import {
  currentMilestone,
  currentObjective,
  dayKey,
  doneTasks,
  launchTasks,
  milestoneCounter,
  milestoneTasks,
  objectivesOf,
  taskBlocker,
  todayPlan,
} from "@shared/today";

const STAGES = roadmapStagesFor(5_000);
const DAY = "2026-11-23";
const TODAY = "2026-11-23T09:00:00";
const BEFORE = "2026-11-20T09:00:00";

const doneAt = (at: string, keys: string[], source: MissionDone["source"] = "declared") =>
  Object.fromEntries(keys.map((key) => [key, { at, source }]));
const keysOf = (plan: { tasks: { key: string }[] }) => plan.tasks.map((task) => task.key);

describe("the day's tasks", () => {
  test("the launch first: the next missions in order, while the day has room", () => {
    const plan = todayPlan(STAGES, doneAt(BEFORE, ["idea:chosen"]), DAY);
    expect(plan.phase).toBe("launch");
    expect(keysOf(plan)).toEqual(["brand:logo", "build:claude", "build:landing"]);
    expect(plan.more).toBe(true);
  });

  test("the tasks done today stay in the day; once it is full, one more on demand", () => {
    const done = { ...doneAt(BEFORE, ["idea:chosen"]), ...doneAt(TODAY, ["brand:logo", "build:claude", "build:landing"]) };
    expect(keysOf(todayPlan(STAGES, done, DAY))).toEqual(["brand:logo", "build:claude", "build:landing"]);
    expect(keysOf(todayPlan(STAGES, done, DAY, 1))).toEqual(["brand:logo", "build:claude", "build:landing", "build:accounts"]);
    // The next day starts on what is left.
    expect(keysOf(todayPlan(STAGES, done, "2026-11-24"))[0]).toBe("build:accounts");
  });

  test("new tasks on demand: those done before leave the list, the next ones come", () => {
    const done = { ...doneAt(BEFORE, ["idea:chosen"]), ...doneAt(TODAY, ["brand:logo", "build:claude", "build:landing"]) };
    const since = "2026-11-23T10:00:00";
    const plan = todayPlan(STAGES, done, DAY, 0, since);
    expect(keysOf(plan)).toEqual(["build:accounts", "build:onboarding", "build:first_version"]);
    expect(plan.more).toBe(true);
    // Those done after it stay in the series.
    const later = { ...done, ...doneAt("2026-11-23T10:30:00", ["build:accounts"]) };
    expect(keysOf(todayPlan(STAGES, later, DAY, 0, since))).toEqual(["build:accounts", "build:onboarding", "build:first_version"]);
  });

  test("once launched, new tasks: the day's own ones done leave, the tier's next ones come", () => {
    const launched = doneAt(BEFORE, ["idea:chosen", ...launchTasks(STAGES).map((task) => task.key)]);
    const done = { ...launched, ...doneAt(TODAY, [`daily:video:${DAY}`, `daily:comments:${DAY}`, "mrr_100:format"]) };
    expect(keysOf(todayPlan(STAGES, done, DAY, 0, "2026-11-23T10:00:00"))).toEqual(["mrr_100:paywall"]);
  });

  test("about an hour a day: a long task ends the day", () => {
    const done = doneAt(BEFORE, ["idea:chosen", "brand:logo", "build:claude", "build:landing", "build:accounts", "build:onboarding", "build:first_version", "build:customize", "build:review", "build:online", "build:domain", "payment:whop"]);
    // In-app payment (20), the Whop webhook (10), connecting Whop (5): 35 minutes, 3 tasks.
    expect(keysOf(todayPlan(STAGES, done, DAY))).toEqual(["payment:in_app", "payment:webhook", "payment:connect"]);
  });

  test("once launched: every day's tasks, keyed by the day, and the tier's next mission", () => {
    const done = doneAt(BEFORE, ["idea:chosen", ...launchTasks(STAGES).map((task) => task.key)]);
    const plan = todayPlan(STAGES, done, DAY);
    expect(plan.phase).toBe("growth");
    expect(keysOf(plan)).toEqual([`daily:video:${DAY}`, `daily:comments:${DAY}`, "mrr_100:format"]);
    expect(keysOf(todayPlan(STAGES, { ...done, ...doneAt(TODAY, ["mrr_100:format"]) }, DAY))).toEqual([
      `daily:video:${DAY}`,
      `daily:comments:${DAY}`,
      "mrr_100:format",
    ]);
  });

  test("a launch task waits for the one before it", () => {
    const done = doneAt(BEFORE, ["idea:chosen"]);
    expect(taskBlocker(STAGES, done, "build:claude")?.key).toBe("brand:logo");
    expect(taskBlocker(STAGES, done, "brand:logo")).toBeNull();
    expect(taskBlocker(STAGES, done, `daily:video:${DAY}`)).toBeNull();
  });

  test("a day is the member's own: late at night in Paris is already the next day", () => {
    expect(dayKey(new Date("2026-11-23T23:30:00Z"), "Europe/Paris")).toBe("2026-11-24");
    expect(dayKey(new Date("2026-11-23T22:30:00Z"), "UTC")).toBe("2026-11-23");
  });
});

describe("the tasks done", () => {
  test("every task done, the latest first: the launch's, the tiers' and every day's, not the idea nor the outcomes", () => {
    const done = {
      ...doneAt(BEFORE, ["idea:chosen", "brand:logo"]),
      ...doneAt("2026-11-21T09:00:00", ["build:claude"]),
      ...doneAt("2026-11-21T20:00:00", ["daily:video:2026-11-21"]),
      ...doneAt(TODAY, ["mrr_100:format", "mrr_100:reached", "customer:7_videos"], "observed"),
    };
    const tasks = doneTasks(STAGES, done);
    expect(tasks.map(({ task }) => task.key)).toEqual(["mrr_100:format", "daily:video:2026-11-21", "build:claude", "brand:logo"]);
    expect(tasks[1].task.title).toBe("Poste une vidéo");
    expect(tasks[3].done).toEqual({ at: BEFORE, source: "declared" });
    expect(doneTasks(STAGES, {})).toEqual([]);
  });

  test("in the order of the journey, not of when they were ticked", () => {
    const done = {
      ...doneAt(BEFORE, ["brand:logo"]),
      // Seen in the data before the tasks ahead of them were ticked.
      ...doneAt("2026-11-21T08:00:00", ["build:online", "build:domain", "mrr_100:paywall"], "observed"),
      ...doneAt("2026-11-21T09:00:00", ["build:claude", "daily:video:2026-11-21"]),
      ...doneAt("2026-11-22T09:00:00", ["mrr_100:format", "daily:video:2026-11-22"]),
    };
    expect(doneTasks(STAGES, done).map(({ task }) => task.key)).toEqual([
      "daily:video:2026-11-22",
      "mrr_100:paywall",
      "mrr_100:format",
      "daily:video:2026-11-21",
      "build:domain",
      "build:online",
      "build:claude",
      "brand:logo",
    ]);
  });
});

describe("the milestones", () => {
  const milestones = milestonesFor(5_000);

  test("from the idea to the goal, each checked by a mission of the roadmap", () => {
    expect(milestones[0].key).toBe("idea:chosen");
    expect(milestones.at(-1)).toMatchObject({ key: "mrr_5000:reached", isGoal: true, mrr: 5_000 });
    expect(milestones.every((milestone) => milestone.check.kind !== "manual")).toBe(true);
  });

  test("the tasks that lead to each: its stage's, without the other milestones and the outcomes", () => {
    const keys = (key: string) => milestoneTasks(STAGES, milestones, key).map((task) => task.key);
    expect(keys("build:domain")).toEqual([
      "build:claude",
      "build:landing",
      "build:accounts",
      "build:onboarding",
      "build:first_version",
      "build:customize",
      "build:review",
      "build:online",
      "build:domain",
    ]);
    expect(keys("payment:connect")).toEqual(["payment:whop", "payment:in_app", "payment:webhook", "payment:connect", "payment:test"]);
    expect(keys("video:posted")).toEqual(["video:account", "video:prepare", "video:posted"]);
    expect(keys("mrr_100:reached")).toEqual(["mrr_100:format", "mrr_100:paywall"]);
    expect(keys("idea:chosen")).toEqual([]);
  });

  test("the one in progress, with its figure", () => {
    const done = doneAt(BEFORE, ["idea:chosen", "brand:logo", "build:domain", "payment:connect", "video:track", "video:posted"], "observed");
    const current = currentMilestone(milestones, done)!;
    expect(current.key).toBe("customer:7_videos");
    expect(milestoneCounter(current, { videos: 3, tiktokAccounts: 1, mrr: null })?.label).toBe("3 / 7 vidéos");
    const tier = milestones.find((milestone) => milestone.mrr === 100)!;
    // Intl puts a narrow no-break space before the euro sign.
    expect(milestoneCounter(tier, { videos: 9, tiktokAccounts: 1, mrr: 64 })?.label).toMatch(/^64\s€ \/ 100\s€ par mois$/);
    expect(milestoneCounter(tier, { videos: 9, tiktokAccounts: 1, mrr: null })).toBeNull();
  });
});

describe("the objectives", () => {
  const milestones = milestonesFor(5_000);
  const objectives = objectivesOf(milestones);

  test("launching the SaaS, the first video, the first customer, then one per MRR tier up to the goal", () => {
    expect(objectives.map((objective) => objective.key)).toEqual([
      "launch",
      "first_video",
      "first_customer",
      "mrr_100",
      "mrr_1000",
      "mrr_2500",
      "mrr_5000",
    ]);
    expect(objectives.slice(0, 3).map((objective) => objective.title)).toEqual(["Lancer ton SaaS", "Première vidéo", "Premier client"]);
    const keysOf = (index: number) => objectives[index].milestones.map((milestone) => milestone.key);
    expect(keysOf(0)).toEqual(["idea:chosen", "brand:logo", "build:domain", "payment:connect"]);
    expect(keysOf(1)).toEqual(["video:track", "video:posted"]);
    expect(keysOf(2)).toEqual(["customer:7_videos", "customer:first_payment"]);
    expect(keysOf(3)).toEqual(["mrr_100:reached"]);
    // Intl puts a narrow no-break space before the euro sign.
    expect(objectives[3].title).toMatch(/^100\s€ par mois$/);
    expect(objectives.at(-1)?.milestones.at(-1)?.isGoal).toBe(true);
    // Every milestone is in one objective, once.
    expect(objectives.flatMap((objective) => objective.milestones)).toEqual(milestones);
  });

  test("the one in progress: the first with a milestone not reached", () => {
    expect(currentObjective(objectives, doneAt(BEFORE, ["idea:chosen", "brand:logo"]))?.key).toBe("launch");
    const launched = doneAt(BEFORE, objectives[0].milestones.map((milestone) => milestone.key), "observed");
    expect(currentObjective(objectives, launched)?.key).toBe("first_video");
    const all = doneAt(BEFORE, milestones.map((milestone) => milestone.key), "observed");
    expect(currentObjective(objectives, all)).toBeNull();
  });
});
