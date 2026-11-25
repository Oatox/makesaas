import { useState } from "react";
import { Filter } from "lucide-react";
import type { AdminOnboardingStats, OnboardingStatsPeriod } from "@shared/admin";
import { EmptyState, ErrorState } from "@/components/StateCard";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOnboarding } from "@/hooks/use-admin-onboarding";
import { OnboardingFunnel } from "./OnboardingFunnel";
import { ScreenDropoff } from "./ScreenDropoff";

const PERIODS = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
] as const;

type PeriodValue = (typeof PERIODS)[number]["value"];

/** The three figures at the top: the visitors who started, the accounts and the subscribers among them. */
function Figures({ stats }: { stats: AdminOnboardingStats }) {
  const start = stats.funnel[0]?.users ?? 0;
  const accounts = stats.funnel[1]?.users ?? 0;
  const subscribers = stats.funnel[stats.funnel.length - 1]?.users ?? 0;
  const figures = [
    { label: "Visiteurs", value: start, note: "ont vu le premier écran" },
    { label: "Comptes créés", value: accounts, note: start ? `${formatRate(accounts / start)} des visiteurs` : "—" },
    { label: "Abonnés", value: subscribers, note: start ? `${formatRate(subscribers / start)} des visiteurs` : "—" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {figures.map((figure) => (
        <div key={figure.label} className="card-3d p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">{figure.label}</p>
          <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight tabular-nums">{formatCount(figure.value)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{figure.note}</p>
        </div>
      ))}
    </div>
  );
}

function OnboardingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement des chiffres">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[108px] rounded-[18px]" />
        ))}
      </div>
      <Skeleton className="h-[440px] rounded-[18px]" />
      <Skeleton className="h-[320px] rounded-[18px]" />
    </div>
  );
}

const computedAt = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * /admin/onboarding: where visitors leave between the onboarding's first screen and the subscription,
 * over 7, 30 or 90 days, from the events sent to Amplitude (server/admin/onboarding.ts).
 */
export function AdminOnboardingPage() {
  const [period, setPeriod] = useState<PeriodValue>("30");
  const query = useAdminOnboarding(Number(period) as OnboardingStatsPeriod);
  const stats = query.data;
  const empty = stats && stats.funnel.every((step) => step.users === 0) && stats.screens.length === 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Le parcours des visiteurs, du premier écran de l'onboarding à l'abonnement.
          {stats && <span className="whitespace-nowrap"> Chiffres d'Amplitude, calculés à {computedAt(stats.computedAt)}.</span>}
        </p>
        <SegmentedControl options={PERIODS} value={period} onValueChange={setPeriod} label="Période" className="self-start sm:self-auto" />
      </div>

      {query.isPending ? (
        <OnboardingSkeleton />
      ) : query.isError && !stats ? (
        <ErrorState
          title="Chiffres indisponibles"
          message={query.error.message}
          action={
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Réessayer
            </Button>
          }
        />
      ) : empty ? (
        <EmptyState
          icon={Filter}
          size="large"
          title="Pas encore de visiteurs"
          description="Personne n'a commencé l'onboarding sur cette période. Les chiffres arrivent dès que le suivi tourne en production."
        />
      ) : stats ? (
        <div className={query.isPlaceholderData ? "space-y-4 opacity-60 transition-opacity sm:space-y-5" : "space-y-4 sm:space-y-5"}>
          <Figures stats={stats} />
          <OnboardingFunnel steps={stats.funnel} />
          <ScreenDropoff screens={stats.screens} />
        </div>
      ) : null}
    </div>
  );
}
