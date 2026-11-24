import { useState } from "react";
import { ChevronRight, Rocket } from "lucide-react";
import type { AdminMemberJourney, AdminSaasSummary } from "@shared/admin";
import { objectiveProgress } from "@shared/today";
import { SaasAvatar } from "@/components/saas/SaasAvatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSaasDetail } from "@/hooks/use-admin-profiles";
import { formatAgoShort } from "@/lib/format";
import { plural, SaasDrawer } from "./SaasDrawer";
import { saasProgress } from "./SaasProgress";

/**
 * The member's SaaS on their admin page: one line each (where it stands on the roadmap, at a glance),
 * the one open in their app first; a click opens everything about it in a drawer (SaasDrawer).
 */
export function SaasCard({ userId, journey, hasAccess }: { userId: string; journey: AdminMemberJourney; hasAccess: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const list = [...journey.saas].sort((a, b) => Number(b.id === journey.currentSaasId) - Number(a.id === journey.currentSaasId));
  const open = list.find((saas) => saas.id === openId) ?? null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rocket className="h-5 w-5 text-muted-foreground" />
          SaaS
        </CardTitle>
        <CardDescription>
          {list.length ? "Ouvre un SaaS pour voir son avancement, ses chiffres et ses connexions." : "Le projet du membre et où il en est."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {list.length ? (
          <ul className="space-y-2">
            {list.map((saas) => (
              <li key={saas.id}>
                <SaasRow userId={userId} saas={saas} isCurrent={saas.id === journey.currentSaasId} onOpen={() => setOpenId(saas.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <NoSaas journey={journey} hasAccess={hasAccess} />
        )}
      </CardContent>

      <SaasDrawer userId={userId} saas={open} isCurrent={open?.id === journey.currentSaasId} onClose={() => setOpenId(null)} />
    </Card>
  );
}

/** A SaaS at a glance: its milestone in progress and how far along it is. Its detail is then already loaded for the drawer. */
function SaasRow({ userId, saas, isCurrent, onOpen }: { userId: string; saas: AdminSaasSummary; isCurrent: boolean; onOpen: () => void }) {
  const { data, error } = useAdminSaasDetail(userId, saas.id);
  const progress = data ? saasProgress(data.roadmap) : null;
  const objective = progress ? (progress.current ?? progress.objectives.at(-1)) : null;
  const step = data && objective ? objectiveProgress(objective, data.roadmap.done, data.roadmap.progress) : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-border hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SaasAvatar name={saas.name} seed={saas.id} logoUrl={saas.logoUrl} className="size-11 rounded-xl text-sm" />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-medium">{saas.name}</span>
          {isCurrent && <span title="Ouvert dans son app" className="size-1.5 shrink-0 rounded-full bg-success" />}
        </p>
        {progress && objective ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {progress.current ? `Palier ${progress.currentIndex + 1} sur ${progress.objectives.length} · ${objective.title}` : "Objectif atteint"}
            {progress.lastProgressAt && ` · ${formatAgoShort(progress.lastProgressAt)}`}
          </p>
        ) : error ? (
          <p className="mt-0.5 text-sm text-destructive">Impossible de charger son avancement</p>
        ) : (
          <Skeleton className="mt-1.5 h-3.5 w-56" />
        )}
      </div>

      {step && (
        <div className="hidden w-36 shrink-0 sm:block">
          <p className="text-right text-xs tabular-nums text-muted-foreground">
            {step.total === 1 && step.counter ? step.counter.label : `${step.reached} / ${step.total} étapes`}
          </p>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(step.complete ? 1 : step.share) * 100}%` }} />
          </span>
        </div>
      )}

      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function NoSaas({ journey, hasAccess }: { journey: AdminMemberJourney; hasAccess: boolean }) {
  const detail = !hasAccess
    ? "Le SaaS se crée sur /lancement, une fois abonné."
    : journey.ideas.shown
      ? `Choix de l'idée en cours sur /lancement : ${plural(journey.ideas.shown, "idée")} vue${journey.ideas.shown > 1 ? "s" : ""}.`
      : "Aucune idée proposée par Gus pour l'instant.";
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/70 p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Rocket className="size-5 text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">Pas encore de SaaS</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
