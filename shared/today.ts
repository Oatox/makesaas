import type { Milestone, MissionDone, RoadmapMission, RoadmapProgress, RoadmapStage } from "./roadmap";
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
  /** Whether there are tasks left to give ("Demander de nouvelles tâches"). */
  more: boolean;
};

const minutesOf = (tasks: RoadmapMission[]) => tasks.reduce((total, task) => total + (task.minutes ?? 0), 0);

/**
 * The tasks of `day`, for the member who already asked `extra` more. Before the launch: the launch
 * missions done that day, then the next ones while the day has room (at least one). After: the day's
 * own tasks, and the tier's next mission.
 *
 * `since`: the member asked new tasks at that time ("demande de nouvelles tâches"): the tasks done
 * before it leave the list (Accueil shows them in "Tâches accomplies"), and the next TASKS_PER_DAY
 * come, without the day's time budget since they asked for them.
 */
export function todayPlan(
  stages: RoadmapStage[],
  done: Record<string, MissionDone>,
  day: string,
  extra = 0,
  since: string | null = null,
): TodayPlan {
  const sinceMs = since ? Date.parse(since) : null;
  const doneOn = (task: RoadmapMission) => {
    const record = done[task.key];
    return !!record && dayKey(new Date(record.at)) === day && (sinceMs === null || Date.parse(record.at) >= sinceMs);
  };
  // A new series: the done ones before it are out of the list, the time budget too.
  const doneBefore = (task: RoadmapMission) => sinceMs !== null && !!done[task.key] && !doneOn(task);

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

  const budget = sinceMs === null ? MINUTES_PER_DAY : Number.POSITIVE_INFINITY;
  if (!isLaunched(stages, done)) {
    const { tasks, more } = pick(launchTasks(stages), TASKS_PER_DAY, budget);
    return { phase: "launch", tasks, more };
  }
  const daily = dailyTasks(day).filter((task) => !doneBefore(task));
  const { tasks, more } = pick(growthTasks(stages, done), sinceMs === null ? 1 : TASKS_PER_DAY, budget);
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

export type DoneTask = { task: RoadmapMission; done: MissionDone };

/** The key of an every day's task, with its day ("daily:video:2026-11-23"). */
const DAILY_KEY = /^daily:[^:]+:(\d{4}-\d{2}-\d{2})$/;

/**
 * Every task already done, in the order of the journey, the furthest first: not by when it was ticked
 * (a task seen in the data, or ticked late, keeps its place). The launch missions in their order, then
 * those of the MRR tiers in theirs and every day's day by day (found again from the day in their key),
 * these two side by side as they were done. Not the idea, nor the milestones only the data reaches
 * (a payment, an MRR, a number of videos). Accueil lists those out of the day's tasks.
 */
export function doneTasks(stages: RoadmapStage[], done: Record<string, MissionDone>): DoneTask[] {
  const doneOf = (tasks: RoadmapMission[]): DoneTask[] => tasks.flatMap((task) => (done[task.key] ? [{ task, done: done[task.key] }] : []));
  const days = Array.from(new Set(Object.keys(done).flatMap((key) => DAILY_KEY.exec(key)?.[1] ?? []))).sort();
  const daily = doneOf(days.flatMap((day) => dailyTasks(day)));
  const tiers = doneOf(stages.filter((stage) => stage.mrr).flatMap(tierTasks));
  // After the launch: each of the two keeps its order, the next one taken from the one done first.
  const growth: DoneTask[] = [];
  while (daily.length || tiers.length) {
    const fromTiers = tiers.length > 0 && (!daily.length || Date.parse(tiers[0].done.at) <= Date.parse(daily[0].done.at));
    growth.push((fromTiers ? tiers : daily).shift()!);
  }
  return [...doneOf(launchTasks(stages)), ...growth].reverse();
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

/**
 * An objective of the way: one of the Roadmap's nodes and the top of Accueil ("Lancer ton SaaS",
 * "Première vidéo", "Premier client", then each monthly amount up to the member's own goal, the last
 * one), made of steps: the milestones checked from the data.
 */
export type Objective = {
  key: string;
  /** "Lancer ton SaaS", "100 € par mois". */
  title: string;
  milestones: Milestone[];
};

/** The objective of the milestones before the revenue ones, by their stage (the start of their key). */
const OBJECTIVE_OF_STAGE: Record<string, Omit<Objective, "milestones">> = {
  idea: { key: "launch", title: "Lancer ton SaaS" },
  brand: { key: "launch", title: "Lancer ton SaaS" },
  build: { key: "launch", title: "Lancer ton SaaS" },
  payment: { key: "launch", title: "Lancer ton SaaS" },
  video: { key: "first_video", title: "Première vidéo" },
  customer: { key: "first_customer", title: "Premier client" },
};

/**
 * The milestones as objectives, in order: launching the SaaS (idea, logo, app online, payments), the
 * first video (TikTok account, first video), the first customer (7 videos, first payment), then one
 * per MRR tier up to the goal, each its single step.
 */
export function objectivesOf(milestones: Milestone[]): Objective[] {
  const objectives: Objective[] = [];
  for (const milestone of milestones) {
    const group = milestone.mrr
      ? { key: `mrr_${milestone.mrr}`, title: `${euros.format(milestone.mrr)} par mois` }
      : (OBJECTIVE_OF_STAGE[milestone.key.split(":")[0]] ?? { key: "growth", title: "Faire grandir ton SaaS" });
    const last = objectives.at(-1);
    if (last?.key === group.key) last.milestones.push(milestone);
    else objectives.push({ ...group, milestones: [milestone] });
  }
  return objectives;
}

/** The objective the member works towards: the first one with a milestone not reached; null once all are. */
export function currentObjective(objectives: Objective[], done: Record<string, MissionDone>): Objective | null {
  return objectives.find((objective) => objective.milestones.some((milestone) => !done[milestone.key])) ?? null;
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
