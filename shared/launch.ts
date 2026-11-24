/**
 * Where a member is on /lancement (client/src/pages/Launch.tsx), saved on profiles.launch_step so they
 * resume there after a reload, a new sign-in or on another device. None saved (null): choosing among
 * Gus's ideas. Then `project` (the idea chosen, profiles.launch_idea_id, until its SaaS is created),
 * the plan, the tour of the app, the first mission, and `done` once they enter the app.
 * Mirrored by profiles_launch_step_check in supabase_setup.sql (section 13).
 */
export const LAUNCH_STEPS = ["project", "plan", "tour", "mission", "done"] as const;
export type LaunchStep = (typeof LAUNCH_STEPS)[number];

/** Where /lancement opens: the ideas, or a saved step. */
export type LaunchResume = "ideas" | LaunchStep;

/**
 * The step to resume, from the saved one and whether the member has a SaaS (the project, created at
 * the end of `project`).
 */
export function resumeLaunch(saved: LaunchStep | null, hasSaas: boolean): LaunchResume {
  // No SaaS (none yet, or deleted since): the ideas, or the idea already chosen.
  if (!hasSaas) return saved === "project" ? "project" : "ideas";
  // A SaaS without any step saved: a launch finished before steps were saved.
  if (saved === null) return "done";
  // Still `project` with the SaaS created: its next step was not saved, so the plan.
  return saved === "project" ? "plan" : saved;
}

/** The launch is over: the app opens. Otherwise ProtectedRoute sends the member back to /lancement. */
export function launchFinished(saved: LaunchStep | null, hasSaas: boolean): boolean {
  return resumeLaunch(saved, hasSaas) === "done";
}
