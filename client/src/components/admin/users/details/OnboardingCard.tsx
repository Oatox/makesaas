import { useState } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
import type { AdminMemberJourney } from "@shared/admin";
import { DEFAULT_MONTHLY_GOAL } from "@shared/roadmap";
import { formatMoney } from "@/components/revenue/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingDrawer, useQuestionnaire } from "./OnboardingDrawer";
import { plural } from "./SaasDrawer";

/**
 * The member's onboarding on their admin page: one line (who they are, their goal); a click opens
 * every answer in a drawer (OnboardingDrawer). Also counts the SaaS ideas Gus showed them.
 */
export function OnboardingCard({ journey }: { journey: AdminMemberJourney }) {
  const [open, setOpen] = useState(false);
  const { count, name, age } = useQuestionnaire(journey.onboarding);
  const { monthlyGoal, ideas } = journey;
  const goal = `Objectif ${formatMoney(monthlyGoal ?? DEFAULT_MONTHLY_GOAL, "EUR")} / mois${monthlyGoal ? "" : " (par défaut)"}`;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          Questionnaire
        </CardTitle>
        <CardDescription>
          Ses réponses à l'onboarding, que Gus lit pour ses idées et ses conseils.
          {ideas.requests > 0 &&
            ` ${ideas.shown} idée${ideas.shown > 1 ? "s" : ""} de SaaS proposée${ideas.shown > 1 ? "s" : ""} (${ideas.requests} demande${ideas.requests > 1 ? "s" : ""}).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {count > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group flex w-full items-center gap-4 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-border hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <ClipboardList className="size-5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{[name, age].filter(Boolean).join(", ") || "Ses réponses"}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {plural(count, "réponse")} · {goal}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/70 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <ClipboardList className="size-5 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Aucune réponse enregistrée</p>
              <p className="text-sm text-muted-foreground">
                Compte créé avant le questionnaire, ou pas encore passé par l'abonnement. {goal}.
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <OnboardingDrawer journey={journey} open={open} onOpenChange={setOpen} />
    </Card>
  );
}
