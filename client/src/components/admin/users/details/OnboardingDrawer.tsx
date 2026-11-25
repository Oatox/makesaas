import { useMemo } from "react";
import type { AdminMemberJourney } from "@shared/admin";
import type { OnboardingProfile } from "@shared/onboarding-profile";
import { DEFAULT_MONTHLY_GOAL } from "@shared/roadmap";
import { readOnboardingProfile, type ReadAnswer } from "@/components/onboarding/profile";
import { formatMoney } from "@/components/revenue/stats";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { InfoRows, plural, Section } from "./SaasDrawer";

/** Answers shown first, as the member's key facts (by step id of client/src/components/onboarding/steps.tsx). */
const FACTS: { stepId: string; label: string }[] = [
  { stepId: "age", label: "Âge" },
  { stepId: "profil", label: "Situation" },
  { stepId: "experience", label: "Expérience" },
  { stepId: "time", label: "Temps par semaine" },
  { stepId: "echeance", label: "Échéance" },
  { stepId: "perseverance", label: "Motivation" },
];

/** The other answers, by theme; an answer no theme lists (a step added later) goes to "Autres réponses". */
const THEMES: { title: string; stepIds: string[] }[] = [
  { title: "Sa situation", stepIds: ["satisfaction", "changement", "merite", "frustrations"] },
  { title: "Ses blocages", stepIds: ["pq-jamais", "pq-en-cours", "pq-abandon", "pq-vendu", "pq-tourne", "frein"] },
  { title: "Ses envies", stepIds: ["vie", "passion", "phrase"] },
  { title: "Son engagement", stepIds: ["action", "investir"] },
];

const NAME_STEP = "prenom";
/** Shown as the goal, from `monthlyGoal`. */
const GOAL_STEP = "revenu";

/** The member's answers read back and sorted: their first name, key facts, then the others by theme. */
export function useQuestionnaire(onboarding: OnboardingProfile | null) {
  return useMemo(() => {
    const answers = onboarding ? readOnboardingProfile(onboarding) : [];
    const byStep = new Map(answers.filter((a) => a.stepId).map((a) => [a.stepId, a]));
    const placed = new Set([NAME_STEP, GOAL_STEP, ...FACTS.map((f) => f.stepId), ...THEMES.flatMap((t) => t.stepIds)]);
    const inTheme = (stepIds: string[]) => answers.filter((a) => a.stepId && stepIds.includes(a.stepId));

    return {
      count: answers.length,
      name: byStep.get(NAME_STEP)?.answer,
      age: byStep.get("age")?.answer,
      facts: FACTS.flatMap((fact) => {
        const answer = byStep.get(fact.stepId);
        return answer ? [{ ...fact, answer }] : [];
      }),
      themes: [
        ...THEMES.map((theme) => ({ title: theme.title, answers: inTheme(theme.stepIds) })),
        { title: "Autres réponses", answers: answers.filter((a) => !a.stepId || !placed.has(a.stepId)) },
      ].filter((theme) => theme.answers.length > 0),
    };
  }, [onboarding]);
}

/** The member's answers to the onboarding, in a drawer over their admin page. Read only. */
export function OnboardingDrawer({
  journey,
  open,
  onOpenChange,
}: {
  journey: AdminMemberJourney;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto p-5 sm:max-w-2xl sm:p-7">
        <SheetTitle className="sr-only">Questionnaire</SheetTitle>
        <SheetDescription className="sr-only">Ses réponses à l'onboarding.</SheetDescription>
        <OnboardingDrawerBody journey={journey} />
      </SheetContent>
    </Sheet>
  );
}

function OnboardingDrawerBody({ journey }: { journey: AdminMemberJourney }) {
  const { count, name, facts, themes } = useQuestionnaire(journey.onboarding);
  const goal = journey.monthlyGoal;

  return (
    <div className="space-y-7">
      <header className="pr-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Questionnaire</p>
        <h2 className="mt-1 font-display text-2xl font-light leading-tight">{name ?? "Ses réponses"}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {plural(count, "réponse")} à l'onboarding, que Gus lit pour ses idées et ses conseils.
        </p>
      </header>

      <Section title="En bref">
        <InfoRows
          rows={[
            {
              label: "Objectif",
              value: (
                <span className="font-medium text-primary">
                  {formatMoney(goal ?? DEFAULT_MONTHLY_GOAL, "EUR")} par mois
                  {!goal && <span className="font-normal text-muted-foreground"> (par défaut, aucun choisi)</span>}
                </span>
              ),
            },
            ...facts.map((fact) => ({ label: fact.label, value: <FactValue answer={fact.answer} /> })),
          ]}
        />
      </Section>

      {themes.map((theme) => (
        <Section key={theme.title} title={theme.title}>
          <dl className="divide-y divide-border/60 rounded-xl border border-border/60">
            {theme.answers.map((answer) => (
              <div key={answer.question} className="px-4 py-3">
                <dt className="text-sm text-muted-foreground">{answer.question}</dt>
                <dd className="mt-2">
                  <AnswerValue answer={answer} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      ))}
    </div>
  );
}

/** A key fact; a slider in words with its level ("Déterminé", 4 of 5). */
function FactValue({ answer }: { answer: ReadAnswer }) {
  const { level } = answer;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="font-medium">{answer.answer}</span>
      {level && (
        <span className="flex w-24 gap-1" aria-label={`${level.value} sur ${level.max}`}>
          {Array.from({ length: level.max }, (_, index) => (
            <span key={index} className={cn("h-1 flex-1 rounded-full", index < level.value ? "bg-primary" : "bg-secondary")} />
          ))}
        </span>
      )}
    </span>
  );
}

/** A choice as its options (chips with the onboarding's icons), a written answer as a quote. */
function AnswerValue({ answer }: { answer: ReadAnswer }) {
  if (!answer.choices?.length) {
    return answer.written ? (
      <p className="border-l-2 border-primary/40 pl-3 text-sm italic">« {answer.answer} »</p>
    ) : (
      <p className="text-sm font-medium">{answer.answer}</p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {answer.choices.map((choice) => (
        <span
          key={choice.label}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium",
            choice.written ? "border-dashed border-border italic" : "border-border/60 bg-secondary/60",
          )}
        >
          {choice.icon && <choice.icon className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 break-words">{choice.written ? `« ${choice.label} »` : choice.label}</span>
        </span>
      ))}
      {answer.detail && <span className="text-sm font-medium italic">« {answer.detail} »</span>}
    </div>
  );
}
