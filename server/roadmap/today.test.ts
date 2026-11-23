import { describe, expect, test } from "bun:test";
import type { MissionDone } from "@shared/roadmap";
import { milestonesFor, roadmapStagesFor } from "@shared/roadmap-missions";
import {
  currentMilestone,
  currentObjective,
  dayKey,
  doneTasks,
  illustrationOf,
  launchTasks,
  milestoneCounter,
  milestoneTasks,
  objectivesOf,
  taskBlocker,
  tasksTickedAfter,
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
    expect(keysOf(plan)).toEqual(["brand:logo", "build:claude", "build:first_version"]);
    expect(plan.more).toBe(true);
  });

  test("the tasks done today stay in the day; once it is full, one more on demand", () => {
    const done = { ...doneAt(BEFORE, ["idea:chosen"]), ...doneAt(TODAY, ["brand:logo", "build:claude", "build:first_version"]) };
    expect(keysOf(todayPlan(STAGES, done, DAY))).toEqual(["brand:logo", "build:claude", "build:first_version"]);
    expect(keysOf(todayPlan(STAGES, done, DAY, 1))).toEqual(["brand:logo", "build:claude", "build:first_version", "build:online"]);
    // The next day starts on what is left.
    expect(keysOf(todayPlan(STAGES, done, "2026-11-24"))[0]).toBe("build:online");
  });

  test("about an hour a day: a long task ends the day", () => {
    const done = doneAt(BEFORE, ["idea:chosen", "brand:logo", "build:claude", "build:first_version", "build:online", "payment:whop"]);
    // In-app payment (15), payment test (10), connect (5): 30 minutes, 3 tasks.
    expect(keysOf(todayPlan(STAGES, done, DAY))).toEqual(["payment:in_app", "payment:test", "payment:connect"]);
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

  test("a launch task waits for the one before it; unticking one unticks those ticked after", () => {
    const done = doneAt(BEFORE, ["idea:chosen"]);
    expect(taskBlocker(STAGES, done, "build:claude")?.key).toBe("brand:logo");
    expect(taskBlocker(STAGES, done, "brand:logo")).toBeNull();
    expect(taskBlocker(STAGES, done, `daily:video:${DAY}`)).toBeNull();
    const ticked = { ...done, ...doneAt(BEFORE, ["brand:logo"], "observed"), ...doneAt(BEFORE, ["build:claude", "build:first_version"]) };
    expect(tasksTickedAfter(STAGES, ticked, "build:claude")).toEqual(["build:first_version"]);
    expect(tasksTickedAfter(STAGES, ticked, "build:first_version")).toEqual([]);
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
    expect(keys("build:online")).toEqual(["build:claude", "build:first_version", "build:online"]);
    expect(keys("payment:connect")).toEqual(["payment:whop", "payment:in_app", "payment:test", "payment:connect"]);
    expect(keys("video:posted")).toEqual(["video:account", "video:prepare", "video:posted"]);
    expect(keys("mrr_100:reached")).toEqual(["mrr_100:format", "mrr_100:paywall"]);
    expect(keys("idea:chosen")).toEqual([]);
  });

  test("the one in progress, with its figure", () => {
    const done = doneAt(BEFORE, ["idea:chosen", "brand:logo", "build:online", "payment:connect", "video:track", "video:posted"], "observed");
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

  test("launching the SaaS, then one per MRR tier up to the goal, with the milestones that lead to it", () => {
    expect(objectives.map((objective) => objective.key)).toEqual(["launch", "mrr_100", "mrr_1000", "mrr_2500", "mrr_5000"]);
    expect(objectives[0].title).toBe("Lancer ton SaaS");
    expect(objectives[0].milestones.map((milestone) => milestone.key)).toEqual([
      "idea:chosen",
      "brand:logo",
      "build:online",
      "payment:connect",
      "video:track",
      "video:posted",
    ]);
    expect(objectives[1].milestones.map((milestone) => milestone.key)).toEqual(["customer:7_videos", "customer:first_payment", "mrr_100:reached"]);
    // Intl puts a narrow no-break space before the euro sign.
    expect(objectives[1].title).toMatch(/^Atteindre 100\s€ par mois$/);
    // Every milestone is in one objective, once.
    expect(objectives.flatMap((objective) => objective.milestones)).toEqual(milestones);
  });

  test("the one in progress: the first with a milestone not reached", () => {
    expect(currentObjective(objectives, doneAt(BEFORE, ["idea:chosen", "brand:logo"]))?.key).toBe("launch");
    const launched = doneAt(BEFORE, objectives[0].milestones.map((milestone) => milestone.key), "observed");
    expect(currentObjective(objectives, launched)?.key).toBe("mrr_100");
    const all = doneAt(BEFORE, milestones.map((milestone) => milestone.key), "observed");
    expect(currentObjective(objectives, all)).toBeNull();
  });
});

describe("the banners", () => {
  test("each task wears the one of its kind of work; one it carries (Gus's) wins", () => {
    const byKey = Object.fromEntries(launchTasks(STAGES).map((task) => [task.key, illustrationOf(task)]));
    expect(byKey["brand:logo"]).toBe("brand");
    expect(byKey["build:first_version"]).toBe("build");
    expect(byKey["build:online"]).toBe("launch");
    expect(byKey["payment:test"]).toBe("payment");
    expect(byKey["video:posted"]).toBe("video");
    const growth = todayPlan(STAGES, doneAt(BEFORE, ["idea:chosen", ...launchTasks(STAGES).map((task) => task.key)]), DAY).tasks;
    expect(growth.map(illustrationOf)).toEqual(["video", "community", "video"]);
    const fromGus = { ...growth[0], key: "gus:2026-11-23:1", illustration: "growth" as const };
    expect(illustrationOf(fromGus)).toBe("growth");
    expect(illustrationOf({ ...growth[0], key: "gus:2026-11-23:2", illustration: undefined })).toBe("strategy");
  });
});
