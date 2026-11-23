import type { Milestone, MissionDone, RoadmapMission, RoadmapProgress, RoadmapStage, TaskIllustration } from "./roadmap";
import { dailyTasks } from "./roadmap-missions";

/**
 * The day's tasks of Accueil (/accueil), drawn from the roadmap's missions (shared/roadmap-missions.ts):
 *   - until the SaaS is launched, the launch missions in their order (style, build, payment, first
 *     video), a few each day: up to TASKS_PER_DAY, about MINUTES_PER_DAY;
 *   - once it is, every day's tasks (dailyTasks, keyed by the day) and the next mission of the MRR
 *     tier the member works towards.
 * A task is a mission: done the same way (ticked, or seen in the data), saved by its key in
 * roadmap_missions. The tasks done today stay in the day's list, so the day keeps its shape.
 */

export const TASKS_PER_DAY = 3;
export const MINUTES_PER_DAY = 60;

/** A day as "2026-11-24", in `timeZone` (the runtime's own by default: the member's, in the browser). */
export function dayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const LAUNCH_STAGES = ["brand", "build", "payment", "video"];

/** The launch missions, in their order: from the logo to the first video. */
export function launchTasks(stages: RoadmapStage[]): RoadmapMission[] {
  return stages.filter((stage) => LAUNCH_STAGES.includes(stage.key)).flatMap((stage) => stage.missions);
}

/** Launched: every launch mission is done. */
export function isLaunched(stages: RoadmapStage[], done: Record<string, MissionDone>): boolean {
  return launchTasks(stages).every((task) => done[task.key]);
}

/** The missions of an MRR tier that are tasks: ticked, or a number of TikTok accounts. Its reached MRR and its video counts are milestones. */
const tierTasks = (stage: RoadmapStage) =>
  stage.missions.filter((mission) => mission.check.kind === "manual" || mission.check.kind === "tiktok_accounts");

/** The tasks of the MRR tier the member works towards: the first one not reached. */
export function growthTasks(stages: RoadmapStage[], done: Record<string, MissionDone>): RoadmapMission[] {
  const tier = stages.find((stage) => stage.mrr && stage.missions.some((mission) => mission.check.kind === "mrr" && !done[mission.key]));
  return tier ? tierTasks(tier) : [];
}

export type TodayPlan = {
  phase: "launch" | "growth";
  /** The day's tasks, in order: those done today first. */
  tasks: RoadmapMission[];
  /** Whether "Une tâche de plus" has one to add. */
  more: boolean;
};

const minutesOf = (tasks: RoadmapMission[]) => tasks.reduce((total, task) => total + (task.minutes ?? 0), 0);

/**
 * The tasks of `day`, for the member who already asked `extra` more. Before the launch: the launch
 * missions done that day, then the next ones while the day has room (at least one). After: the day's
 * own tasks, and the tier's next mission.
 */
export function todayPlan(stages: RoadmapStage[], done: Record<string, MissionDone>, day: string, extra = 0): TodayPlan {
  const doneOn = (task: RoadmapMission) => {
    const record = done[task.key];
    return !!record && dayKey(new Date(record.at)) === day;
  };

  const pick = (catalog: RoadmapMission[], limit: number, budget: number) => {
    const today = catalog.filter(doneOn);
    const ahead = catalog.filter((task) => !done[task.key]);
    const planned: RoadmapMission[] = [];
    for (const task of ahead) {
      const count = today.length + planned.length;
      if (count >= limit) break;
      if (count > 0 && minutesOf([...today, ...planned, task]) > budget) break;
      planned.push(task);
    }
    const added = ahead.slice(planned.length, planned.length + extra);
    return { tasks: [...today, ...planned, ...added], more: ahead.length > planned.length + added.length };
  };

  if (!isLaunched(stages, done)) {
    const { tasks, more } = pick(launchTasks(stages), TASKS_PER_DAY, MINUTES_PER_DAY);
    return { phase: "launch", tasks, more };
  }
  const daily = dailyTasks(day);
  const { tasks, more } = pick(growthTasks(stages, done), 1, MINUTES_PER_DAY);
  return { phase: "growth", tasks: [...daily, ...tasks], more };
}

/**
 * The launch mission to finish before this one: the missions are done in their order, those checked
 * from the data included. Null for a task outside the launch (every day's, a tier's).
 */
export function taskBlocker(stages: RoadmapStage[], done: Record<string, MissionDone>, key: string): RoadmapMission | null {
  const launch = launchTasks(stages);
  const index = launch.findIndex((task) => task.key === key);
  if (index < 0) return null;
  return launch.slice(0, index).find((task) => !done[task.key]) ?? null;
}

/** The launch missions ticked after this one: unticking it unticks them too, after a confirmation. */
export function tasksTickedAfter(stages: RoadmapStage[], done: Record<string, MissionDone>, key: string): string[] {
  const launch = launchTasks(stages);
  const index = launch.findIndex((task) => task.key === key);
  if (index < 0) return [];
  return launch
    .slice(index + 1)
    .filter((task) => task.check.kind === "manual" && done[task.key]?.source === "declared")
    .map((task) => task.key);
}

export type DoneTask = { task: RoadmapMission; done: MissionDone };

/** The key of an every day's task, with its day ("daily:video:2026-11-23"). */
const DAILY_KEY = /^daily:[^:]+:(\d{4}-\d{2}-\d{2})$/;

/**
 * Every task already done, the latest first: the launch missions, those of every MRR tier, and every
 * day's (found again from the day in their key). Not the idea, nor the milestones only the data
 * reaches (a payment, an MRR, a number of videos). Accueil lists those out of the day's tasks.
 */
export function doneTasks(stages: RoadmapStage[], done: Record<string, MissionDone>): DoneTask[] {
  const catalog = new Map<string, RoadmapMission>();
  for (const task of [...launchTasks(stages), ...stages.filter((stage) => stage.mrr).flatMap(tierTasks)]) catalog.set(task.key, task);
  const found: DoneTask[] = [];
  for (const [key, record] of Object.entries(done)) {
    const day = DAILY_KEY.exec(key)?.[1];
    const task = day ? dailyTasks(day).find((item) => item.key === key) : catalog.get(key);
    if (task) found.push({ task, done: record });
  }
  return found.sort((a, b) => Date.parse(b.done.at) - Date.parse(a.done.at));
}

/** The milestone the member works towards: the first one not reached; null once all are. */
export function currentMilestone(milestones: Milestone[], done: Record<string, MissionDone>): Milestone | null {
  return milestones.find((milestone) => !done[milestone.key]) ?? null;
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Where a milestone in progress stands ("3 / 7 vidéos"), for those with a figure to reach; null
 * otherwise, and without the figures (a server older than them).
 */
export function milestoneCounter(
  milestone: Milestone,
  progress: RoadmapProgress | undefined,
): { value: number; target: number; label: string } | null {
  if (!progress) return null;
  const check = milestone.check;
  switch (check.kind) {
    case "videos":
      return { value: progress.videos, target: check.min, label: `${Math.min(progress.videos, check.min)} / ${check.min} vidéos` };
    case "tiktok_accounts":
      return check.min > 1
        ? { value: progress.tiktokAccounts, target: check.min, label: `${Math.min(progress.tiktokAccounts, check.min)} / ${check.min} comptes TikTok` }
        : null;
    case "mrr":
      return progress.mrr === null
        ? null
        : { value: progress.mrr, target: check.amount, label: `${euros.format(progress.mrr)} / ${euros.format(check.amount)} par mois` };
    default:
      return null;
  }
}

/**
 * The tasks that lead to a milestone: the missions of its stage that the member does (its own when it
 * is one), without the other milestones and the outcomes only the data reaches (a payment, an MRR, a
 * number of videos).
 */
export function milestoneTasks(stages: RoadmapStage[], milestones: Milestone[], key: string): RoadmapMission[] {
  const stage = stages.find((item) => item.missions.some((mission) => mission.key === key));
  if (!stage) return [];
  const others = new Set(milestones.map((milestone) => milestone.key).filter((other) => other !== key));
  return stage.missions.filter((mission) => {
    if (others.has(mission.key)) return false;
    const check = mission.check;
    if (check.kind === "saas" || check.kind === "first_payment" || check.kind === "mrr") return false;
    return !(check.kind === "videos" && check.min > 1);
  });
}

/** The objectives of the journey: its milestones in groups, each ending on one to reach. */
export type Objective = {
  key: string;
  /** "Lancer ton SaaS", "Atteindre 100 € par mois". */
  title: string;
  milestones: Milestone[];
};

/**
 * The milestones as objectives, in order: launching the SaaS (the launch milestones), then one per
 * MRR tier up to the goal, each with the milestones that lead to it (the first videos and customer
 * lead to the first tier).
 */
export function objectivesOf(milestones: Milestone[]): Objective[] {
  const objectives: Objective[] = [];
  const launch = milestones.filter((milestone) => milestone.phase === "launch");
  if (launch.length) objectives.push({ key: "launch", title: "Lancer ton SaaS", milestones: launch });
  let pending: Milestone[] = [];
  for (const milestone of milestones.filter((item) => item.phase === "growth")) {
    pending.push(milestone);
    if (!milestone.mrr) continue;
    objectives.push({ key: `mrr_${milestone.mrr}`, title: `Atteindre ${euros.format(milestone.mrr)} par mois`, milestones: pending });
    pending = [];
  }
  if (pending.length) objectives.push({ key: "growth", title: "Faire grandir ton SaaS", milestones: pending });
  return objectives;
}

/** The objective the member works towards: the first one with a milestone not reached; null once all are. */
export function currentObjective(objectives: Objective[], done: Record<string, MissionDone>): Objective | null {
  return objectives.find((objective) => objective.milestones.some((milestone) => !done[milestone.key])) ?? null;
}

/** Each task's banner, by its key: the launch missions, then the parts of the keys of a tier's and of a day's. */
const ILLUSTRATION_BY_KEY: Record<string, TaskIllustration> = {
  "brand:logo": "brand",
  "build:claude": "account",
  "build:first_version": "build",
  "build:online": "launch",
  "payment:whop": "payment",
  "payment:in_app": "payment",
  "payment:test": "payment",
  "payment:connect": "payment",
  "video:account": "account",
  "video:track": "growth",
  "video:prepare": "video",
  "video:posted": "video",
};
const ILLUSTRATION_BY_PART: [string, TaskIllustration][] = [
  ["daily:video", "video"],
  ["daily:comments", "community"],
  [":format", "video"],
  [":paywall", "payment"],
  ["_accounts", "account"],
  [":retention", "community"],
  [":annual", "payment"],
  [":creators", "community"],
];

/** The banner of a task: its own (Gus's tasks carry one), or the one of its kind of work. */
export function illustrationOf(task: RoadmapMission): TaskIllustration {
  return (
    task.illustration ??
    ILLUSTRATION_BY_KEY[task.key] ??
    ILLUSTRATION_BY_PART.find(([part]) => task.key.includes(part))?.[1] ??
    "strategy"
  );
}

/** Where an objective stands: its steps reached, the one in progress and its figure, the share done. */
export type ObjectiveProgress = {
  reached: number;
  total: number;
  complete: boolean;
  /** When its last step was reached, once complete ("before": before MakeSaaS). */
  reachedAt: MissionDone | null;
  /** Its step in progress; null once complete. */
  current: Milestone | null;
  counter: ReturnType<typeof milestoneCounter>;
  /** From 0 to 1: the steps reached, and the share of the one in progress by its figure. */
  share: number;
};

export function objectiveProgress(
  objective: Objective,
  done: Record<string, MissionDone>,
  progress: RoadmapProgress | undefined,
): ObjectiveProgress {
  const total = objective.milestones.length;
  const reached = objective.milestones.filter((milestone) => done[milestone.key]).length;
  const current = currentMilestone(objective.milestones, done);
  const counter = current ? milestoneCounter(current, progress) : null;
  const partial = counter ? Math.min(1, counter.value / counter.target) : 0;
  const records = objective.milestones.map((milestone) => done[milestone.key]).filter((record): record is MissionDone => !!record);
  const last = current ? null : (records.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] ?? null);
  return {
    reached,
    total,
    complete: !current,
    reachedAt: last,
    current,
    counter,
    share: total ? Math.min(1, (reached + partial) / total) : 0,
  };
}
