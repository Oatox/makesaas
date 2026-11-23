import { buzz } from "./haptics";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Target } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { ContinueButton } from "./ContinueButton";
import { euros, fillTemplate, goalOf, roadmapSteps } from "./insights";
import { OnboardingDialog, OnboardingDialogHeader } from "./OnboardingDialog";
import { QuickQuestionDialog } from "./QuickQuestionDialog";
import { STEP_TITLE_CLASS } from "./StepHeader";
import type { BuildStep as BuildStepConfig } from "./steps";

/** Time spent on each task of the list. */
const TASK_MS = 2200;

/** What the coach does for the plan, in order (nothing is computed: it is a show). */
function buildTasks(answers: OnboardingAnswers) {
  return [
    { doing: "Je lis tes réponses", done: "J'ai lu tes réponses" },
    { doing: "Je choisis les 3 idées faites pour toi", done: "J'ai choisi tes 3 idées" },
    { doing: "J'écris le prompt de ton site", done: "J'ai écrit le prompt de ton site" },
    { doing: "Je cherche où sont tes premiers clients", done: "J'ai trouvé où chercher tes clients" },
    { doing: `Je découpe tes ${euros.format(goalOf(answers))} par mois en étapes`, done: "Ton objectif est découpé en étapes" },
  ];
}

// Progress ring around the coach's face.
const RING = { size: 168, stroke: 6 };
const RADIUS = (RING.size - RING.stroke) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * "On construit ton plan": the coach at work, his face in a ring filling up, and the list of what
 * he does, task by task, paused by two quick questions. Once done, the plan opens in the same
 * dialog, with the roadmap and "Voir mon plan".
 */
export function BuildStep({
  step,
  answers,
  onContinue,
}: {
  step: BuildStepConfig;
  answers: OnboardingAnswers;
  onContinue: (quickAnswers: OnboardingAnswers) => void;
}) {
  const reduceMotion = useReducedMotion();
  const tasks = useMemo(() => buildTasks(answers), [answers]);
  const milestones = roadmapSteps(answers);
  const total = tasks.length * TASK_MS;

  const [elapsed, setElapsed] = useState(0);
  const [quick, setQuick] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState(false);

  const nextQuestion = step.questions.find((q) => !(q.id in quick));
  const limit = (nextQuestion ? nextQuestion.at : 1) * total;
  const pending = nextQuestion && elapsed >= nextQuestion.at * total ? nextQuestion : null;
  const done = elapsed >= total;
  const progress = Math.min(1, elapsed / total);

  // The clock runs up to the next question (or the end), then waits.
  useEffect(() => {
    if (pending || done) return;
    if (reduceMotion) {
      setElapsed(limit);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      setElapsed((e) => Math.min(limit, e + delta));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pending, done, limit, reduceMotion]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => {
      setSheet(true);
      buzz(20);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [done]);

  // Task being done, and how far into it.
  const current = done ? tasks.length : Math.min(tasks.length - 1, Math.floor(elapsed / TASK_MS));
  const taskProgress = done ? 1 : (elapsed - current * TASK_MS) / TASK_MS;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={STEP_TITLE_CLASS}>{fillTemplate("On construit ton plan, {prenom}.", answers)}</h1>

      {/* The coach at work: his face in a ring that fills up, the percentage under it. */}
      <div className="mt-6 flex flex-col items-center">
        <div className="relative" style={{ width: RING.size, height: RING.size }}>
          <svg viewBox={`0 0 ${RING.size} ${RING.size}`} className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx={RING.size / 2} cy={RING.size / 2} r={RADIUS} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={RING.stroke} />
            <circle
              cx={RING.size / 2}
              cy={RING.size / 2}
              r={RADIUS}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={RING.stroke}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
          <span className="absolute inset-[18px] flex items-center justify-center">
            {/* Without the photo's own ring: the progress ring is the only one. */}
            <CoachAvatar className="h-full w-full [&_img]:ring-0" />
          </span>
        </div>
        <p className="mt-4 whitespace-nowrap font-display text-[34px] font-light leading-none tabular-nums" aria-live="polite">
          {Math.round(progress * 100)}
          <span className="ml-1 text-xl text-muted-foreground">%</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{done ? `${COACH_NAME} a fini ton plan` : `${COACH_NAME} prépare ton plan…`}</p>
      </div>

      {/* What he does, task by task: done ones checked, the current one spinning, the next ones waiting. */}
      <ol className="card-3d mt-6 space-y-1 p-2">
        {tasks.map((task, i) => {
          const state = i < current ? "done" : i === current ? "doing" : "todo";
          return (
            <li key={task.done} className={cn("rounded-xl px-3 py-2.5", state === "doing" && "bg-white/[0.04]")}>
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {state === "done" ? (
                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                    </motion.span>
                  ) : state === "doing" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-white/15" />
                  )}
                </span>
                <span className={cn("text-[15px] leading-snug", state === "todo" ? "text-muted-foreground/60" : "text-foreground", state === "done" && "text-foreground/80")}>
                  {state === "done" ? task.done : state === "doing" ? `${task.doing}…` : task.doing}
                </span>
              </div>
              {state === "doing" && (
                <div className="ml-9 mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${taskProgress * 100}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <QuickQuestionDialog question={pending} onAnswer={(id, value) => setQuick((current) => ({ ...current, [id]: value }))} />

      {/* The plan is ready, in the same dialog as the quick questions: the roadmap as a timeline
          (first step done, the goal at the end), then "Voir mon plan". */}
      <OnboardingDialog open={sheet}>
        <OnboardingDialogHeader
          className="text-center"
          title="Ton plan personnalisé est prêt."
          description={fillTemplate("Maintenant, il est temps de passer à l'action, {prenom}.", answers)}
        />

        <ol className="rounded-2xl border border-border/70 bg-background/40 p-4">
          {milestones.map((milestone, i) => {
            const first = i === 0;
            const goal = i === milestones.length - 1;
            return (
              <li key={milestone.title} className="relative flex gap-3.5 pb-5 last:pb-0">
                {/* The line down to the next step: orange from the step already done. */}
                {!goal && <span aria-hidden className={cn("absolute bottom-0.5 left-[13px] top-[31px] w-0.5 rounded-full", first ? "bg-primary" : "bg-white/10")} />}
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    first && "bg-primary text-primary-foreground",
                    goal && "border-2 border-primary text-primary",
                    !first && !goal && "border-2 border-white/15 text-muted-foreground",
                  )}
                >
                  {first ? <Check className="h-4 w-4" strokeWidth={3.5} /> : goal ? <Target className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <b className={cn("block text-[15px] font-semibold leading-tight", goal && "text-primary")}>{milestone.title}</b>
                  <small className="mt-1 block text-[13px] leading-snug text-muted-foreground">{milestone.detail}</small>
                </div>
              </li>
            );
          })}
        </ol>

        <ContinueButton onClick={() => onContinue(quick)} label="Voir mon plan" className="pt-1" />
      </OnboardingDialog>
    </div>
  );
}
