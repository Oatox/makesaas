import { ClipboardList } from "lucide-react";
import type { AdminMemberJourney } from "@shared/admin";
import { DEFAULT_MONTHLY_GOAL } from "@shared/roadmap";
import { formatMoney } from "@/components/revenue/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** The member's answers to the onboarding, their monthly goal and the SaaS ideas Gus showed them. */
export function OnboardingCard({ journey }: { journey: AdminMemberJourney }) {
  const { onboarding, monthlyGoal, ideas } = journey;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              Questionnaire
            </CardTitle>
            <CardDescription>
              Ses réponses à l'onboarding, que Gus lit pour ses idées et ses conseils.
              {ideas.requests > 0 &&
                ` ${ideas.shown} idée${ideas.shown > 1 ? "s" : ""} de SaaS proposée${ideas.shown > 1 ? "s" : ""} (${ideas.requests} demande${ideas.requests > 1 ? "s" : ""}).`}
            </CardDescription>
          </div>
          <Badge variant={monthlyGoal ? "default" : "secondary"} className="w-fit shrink-0" title={monthlyGoal ? undefined : "Objectif par défaut"}>
            Objectif {formatMoney(monthlyGoal ?? DEFAULT_MONTHLY_GOAL, "EUR")} / mois{monthlyGoal ? "" : " (défaut)"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {onboarding ? (
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {onboarding.map(({ question, answer }) => (
              <div key={question} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{question}</dt>
                <dd className="mt-0.5 text-sm font-medium">{answer}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune réponse enregistrée (compte créé avant le questionnaire, ou pas encore passé par l'abonnement).</p>
        )}
      </CardContent>
    </Card>
  );
}
