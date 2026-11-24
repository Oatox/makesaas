import { motion } from "framer-motion";
import { Check, MessageCircle, Target } from "lucide-react";
import { roadmapStagesFor } from "@shared/roadmap-missions";
import type { RoadmapMission, RoadmapStage } from "@shared/roadmap";
import { SAAS_DESCRIPTION_MAX_LENGTH, SAAS_NAME_MAX_LENGTH } from "@shared/saas";
import { ContinueButton } from "@/components/onboarding/ContinueButton";
import { COACH_NAME } from "@/components/brand/Coach";
import { euros } from "@/components/onboarding/insights";
import { APP_PAGES } from "@/config/app-pages";
import { OnboardingDialog, OnboardingDialogHeader } from "@/components/onboarding/OnboardingDialog";
import { stepAppear } from "@/components/onboarding/StepHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// The steps of /lancement once an idea is kept: the project to confirm, the plan, then the first
// mission. All read from the roadmap (shared/roadmap-missions.ts): renaming or reordering its stages
// and missions changes what Gus says here.

/**
 * The member's first mission once their SaaS exists: the first one the SaaS does not already check
 * (the idea is), which is also the first task waiting on Accueil; with its stage.
 */
export function firstMissionFor(goal: number): { stage: RoadmapStage; mission: RoadmapMission } {
  for (const stage of roadmapStagesFor(goal)) {
    const mission = stage.missions.find((item) => item.check.kind !== "saas");
    if (mission) return { stage, mission };
  }
  throw new Error("The roadmap has no mission after the idea");
}

/** A title inside a sentence: "Crée ton logo" → "crée ton logo". */
export function inSentence(title: string): string {
  return title.charAt(0).toLocaleLowerCase("fr") + title.slice(1);
}

/** Step 1: the kept idea's name and sentence, editable before the SaaS is created. */
export function ProjectForm({
  name,
  pitch,
  onNameChange,
  onPitchChange,
  disabled,
}: {
  name: string;
  pitch: string;
  onNameChange: (value: string) => void;
  onPitchChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <motion.div variants={stepAppear} initial="hidden" animate="visible" className="card-3d mt-4 space-y-4 p-4 sm:p-5">
      <div className="space-y-1.5">
        <label htmlFor="project-name" className="text-sm font-medium">
          Le nom de ton app
        </label>
        <Input
          id="project-name"
          value={name}
          maxLength={SAAS_NAME_MAX_LENGTH}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="project-pitch" className="text-sm font-medium">
          Ce qu'elle fait, en une phrase
        </label>
        <Textarea
          id="project-pitch"
          value={pitch}
          maxLength={SAAS_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => onPitchChange(event.target.value)}
          disabled={disabled}
          rows={2}
          className="resize-none text-base"
        />
      </div>
    </motion.div>
  );
}

/**
 * Step 2: the roadmap at a glance, from the idea (done) to the member's monthly goal from the
 * onboarding: the first stages of the roadmap (shared/roadmap-missions.ts), the one of the first
 * mission marked, then the goal. Shown over the chat like the onboarding's plan ("Ton plan
 * personnalisé est prêt", BuildStep): same dialog, same timeline; "Et maintenant ?" goes on.
 */
export function PlanDialog({
  open,
  projectName,
  goal,
  onContinue,
}: {
  open: boolean;
  projectName: string;
  goal: number;
  onContinue: () => void;
}) {
  const stages = roadmapStagesFor(goal);
  const first = firstMissionFor(goal);
  const steps = [
    { key: stages[0].key, title: stages[0].title, detail: projectName, done: true, current: false },
    ...stages.slice(1, 5).map((stage) => {
      const current = stage.key === first.stage.key;
      return {
        key: stage.key,
        title: stage.title,
        detail: current ? `Ta première mission\u00a0: ${inSentence(first.mission.title)}` : null,
        done: false,
        current,
      };
    }),
    { key: "goal", title: `${euros.format(goal)} par mois`, detail: "Ton objectif", done: false, current: false },
  ];

  return (
    <OnboardingDialog open={open}>
      <OnboardingDialogHeader
        className="text-center"
        title={`Ton plan jusqu'à ${euros.format(goal)} par mois`}
        description="Chaque étape se cochera toute seule quand tu l'auras franchie."
      />

      <motion.ol
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}
        className="rounded-2xl border border-border/70 bg-background/40 p-4"
      >
        {steps.map((step, index) => {
          const goalStep = index === steps.length - 1;
          return (
            <motion.li key={step.key} variants={stepAppear} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* The line down to the next step: orange from the step already done. */}
              {!goalStep && (
                <span
                  aria-hidden
                  className={cn("absolute bottom-0.5 left-[13px] top-[31px] w-0.5 rounded-full", step.done ? "bg-primary" : "bg-white/10")}
                />
              )}
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  step.done && "bg-primary text-primary-foreground",
                  (goalStep || step.current) && "border-2 border-primary text-primary",
                  !step.done && !goalStep && !step.current && "border-2 border-white/15 text-muted-foreground",
                )}
              >
                {step.done ? (
                  <Check className="h-4 w-4" strokeWidth={3.5} />
                ) : goalStep ? (
                  <Target className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <b
                  className={cn(
                    "block text-[15px] font-semibold leading-tight",
                    goalStep && "text-primary",
                    !step.done && !step.current && !goalStep && "text-muted-foreground",
                  )}
                >
                  {step.title}
                </b>
                {step.detail && <small className="mt-1 block text-[13px] leading-snug text-muted-foreground">{step.detail}</small>}
              </div>
            </motion.li>
          );
        })}
      </motion.ol>

      <ContinueButton onClick={onContinue} label="Et maintenant ?" className="pt-1" />
    </OnboardingDialog>
  );
}

/**
 * Step 3: Gus's tour of the app, before the first mission, shown as one of his messages (in his
 * bubble): its pages as the sidebar lists them (config/app-pages.ts, each with its `tour` line), then
 * talking to him.
 */
export function AppTour() {
  const stops = [
    ...APP_PAGES.filter((page) => page.tour).map((page) => ({ key: page.href, icon: page.icon, label: page.label, text: page.tour })),
    {
      key: "coach",
      icon: MessageCircle,
      label: `Discuter avec ${COACH_NAME}`,
      text: "Une question, un blocage ? Je te réponds, en connaissant ton projet.",
    },
  ];

  return (
    <ul className="space-y-3.5">
      {stops.map(({ key, icon: Icon, label, text }) => (
        <li key={key} className="flex gap-3">
          <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight">{label}</p>
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
