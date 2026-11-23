import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { roadmapStagesFor } from "@shared/roadmap-missions";
import { SAAS_DESCRIPTION_MAX_LENGTH, SAAS_NAME_MAX_LENGTH } from "@shared/saas";
import { euros } from "@/components/onboarding/insights";
import { stepAppear } from "@/components/onboarding/StepHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// The steps of /lancement once an idea is kept: the project to confirm, then the plan.

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
 * onboarding: the first stages of the roadmap (shared/roadmap-missions.ts), then the goal.
 */
export function PlanPreview({ projectName, goal }: { projectName: string; goal: number }) {
  const stages = roadmapStagesFor(goal);
  const steps = [
    { title: stages[0].title, detail: projectName, done: true },
    ...stages.slice(1, 5).map((milestone, index) => ({
      title: milestone.title,
      detail: index === 0 ? "Ta première mission" : null,
      done: false,
    })),
    { title: `${euros.format(goal)} par mois`, detail: "Ton objectif", done: false },
  ];

  return (
    <motion.ol
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
      className="card-3d mt-4 p-4 sm:p-5"
    >
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const current = index === 1;
        return (
          <motion.li key={step.title} variants={stepAppear} className="relative flex gap-3 pb-5 last:pb-0">
            {/* The trail between two steps. */}
            {!last && (
              <span aria-hidden className={cn("absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px", step.done ? "bg-primary" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                step.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : current
                    ? "border-primary bg-background text-primary"
                    : last
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
              )}
            >
              {step.done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-[15px] font-medium", !step.done && !current && !last && "text-muted-foreground")}>{step.title}</p>
              {step.detail && <p className="text-sm text-muted-foreground">{step.detail}</p>}
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
