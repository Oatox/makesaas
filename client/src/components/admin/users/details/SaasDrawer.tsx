import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";
import type { AdminDiscussionSummary, AdminSaasDetail, AdminSaasSummary } from "@shared/admin";
import { COACH_NAME } from "@/components/brand/Coach";
import { REVENUE_PROVIDER_NAMES } from "@shared/revenue";
import { SaasAvatar } from "@/components/saas/SaasAvatar";
import { formatMoney } from "@/components/revenue/stats";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSaasDetail } from "@/hooks/use-admin-profiles";
import { formatAgoShort, formatCompact, formatInteger, formatShortDate } from "@/lib/format";
import { DiscussionList, DiscussionView } from "./Discussions";
import { DoneTaskList, MilestoneList, ObjectivesBar, saasProgress } from "./SaasProgress";

export const plural = (count: number, word: string) => `${formatInteger(count)} ${word}${count > 1 ? "s" : ""}`;

/** The address without its protocol, to show it ("monapp.base44.app/accueil"). */
const shortUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * One SaaS of a member, in a drawer over their admin page: what it is, where it stands on the
 * roadmap (as the member sees it on Accueil and Roadmap), its figures, its discussions with Gus (each
 * read in the drawer itself, with a way back) and its connections. Read only.
 */
export function SaasDrawer({
  userId,
  saas,
  isCurrent,
  onClose,
}: {
  userId: string;
  /** The SaaS shown; null: closed. */
  saas: AdminSaasSummary | null;
  isCurrent: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!saas} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto p-5 sm:max-w-2xl sm:p-7">
        {saas && (
          <>
            <SheetTitle className="sr-only">{saas.name}</SheetTitle>
            <SheetDescription className="sr-only">Le SaaS du membre et où il en est.</SheetDescription>
            <SaasDrawerBody key={saas.id} userId={userId} saas={saas} isCurrent={isCurrent} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SaasDrawerBody({ userId, saas, isCurrent }: { userId: string; saas: AdminSaasSummary; isCurrent: boolean }) {
  const { data, error, refetch, isRefetching } = useAdminSaasDetail(userId, saas.id);
  const [discussion, setDiscussion] = useState<AdminDiscussionSummary | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);

  // A discussion opens at its top; going back finds the SaaS where it was left. The drawer scrolls.
  const scroller = () => rootRef.current?.closest<HTMLElement>("[role=dialog]") ?? null;
  const openDiscussion = (next: AdminDiscussionSummary) => {
    savedScroll.current = scroller()?.scrollTop ?? 0;
    setDiscussion(next);
  };
  useLayoutEffect(() => {
    const element = scroller();
    if (element) element.scrollTop = discussion ? 0 : savedScroll.current;
  }, [discussion]);

  return (
    <div ref={rootRef}>
      {discussion && (
        <DiscussionView userId={userId} discussion={discussion} backLabel={saas.name} onBack={() => setDiscussion(null)} />
      )}
      {/* Kept mounted under an open discussion, so the way back finds it as it was. */}
      <div className={discussion ? "hidden" : "space-y-7"}>
        <header className="flex items-start gap-4 pr-10">
          <SaasAvatar name={saas.name} seed={saas.id} logoUrl={saas.logoUrl} className="size-14 rounded-2xl text-lg" />
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isCurrent ? "Ouvert dans son app" : "SaaS"}</p>
            <h2 className="mt-1 font-display text-2xl font-light leading-tight">{saas.name}</h2>
            {data ? (
              <p className="mt-1.5 text-sm text-muted-foreground">{data.description || "Pas encore décrit."}</p>
            ) : (
              !error && <Skeleton className="mt-2 h-4 w-64" />
            )}
          </div>
        </header>

        {data ? (
          <SaasDetail saas={data} onOpenDiscussion={openDiscussion} />
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Impossible de charger ce SaaS</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {error.message}
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
                Réessayer
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-7">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-[92px] rounded-xl" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Section({ title, children, sectionRef }: { title: string; children: ReactNode; sectionRef?: Ref<HTMLElement> }) {
  return (
    <section ref={sectionRef} className="scroll-mt-4">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** Label → value rows, in one block. */
export function InfoRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border/60 rounded-xl border border-border/60">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <dt className="text-sm text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 text-sm">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SaasDetail({ saas, onOpenDiscussion }: { saas: AdminSaasDetail; onOpenDiscussion: (discussion: AdminDiscussionSummary) => void }) {
  const discussionsRef = useRef<HTMLElement>(null);
  const roadmap = saas.roadmap;
  const progress = saasProgress(roadmap);
  const current = progress.current;
  const shown = current ?? progress.objectives.at(-1);

  const project = [
    ...(saas.audience ? [{ label: "Pour qui", value: saas.audience }] : []),
    ...(saas.idea?.feature ? [{ label: "Fonctionnalité principale", value: saas.idea.feature }] : []),
    ...(saas.idea?.problem ? [{ label: "Problème réglé", value: saas.idea.problem }] : []),
    ...(saas.idea?.price ? [{ label: "Prix conseillé", value: `${saas.idea.price.toLocaleString("fr-FR")} € par mois` }] : []),
    { label: "Créé le", value: `${formatShortDate(saas.createdAt)}${saas.idea ? "" : " (sans idée de Gus)"}` },
    {
      label: "Son app",
      value: saas.appUrl ? (
        <a
          href={saas.appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <span className="truncate">{shortUrl(saas.appUrl)}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
      ) : (
        <span className="text-muted-foreground">Pas encore en ligne</span>
      ),
    },
  ];

  const facts = [
    {
      label: "Phase",
      value: progress.phase === "launch" ? `Lancement · ${progress.launchDone} / ${progress.launchTotal}` : "Croissance",
    },
    { label: "Prochaine tâche", value: progress.nextTask?.title ?? "Tâches du jour faites" },
    { label: "Dernière avancée", value: progress.lastProgressAt ? formatAgoShort(progress.lastProgressAt) : "Aucune" },
  ];

  const { revenue, payment, tiktok, discussions } = saas;
  const lastDiscussion = discussions.latest[0];
  const discussionMessages = discussions.latest.reduce((total, item) => total + item.messages, 0);

  return (
    <>
      <Section title="Avancement">
        <div className="rounded-xl border border-primary/25 bg-primary/[0.05] p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">
                {current ? `Palier ${progress.currentIndex + 1} sur ${progress.objectives.length}` : "Objectif atteint"}
              </p>
              <p className="mt-1 truncate text-lg font-semibold">{shown?.title}</p>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
              Objectif {formatMoney(roadmap.goal, "EUR")} / mois
            </p>
          </div>
          <div className="mt-4">
            <ObjectivesBar objectives={progress.objectives} roadmap={roadmap} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium" title={fact.value}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section title="Paliers">
        <MilestoneList objectives={progress.objectives} current={current} roadmap={roadmap} />
      </Section>

      <Section title="Chiffres">
        <div className="grid grid-cols-2 gap-3">
          <Figure
            label="MRR"
            value={revenue ? formatMoney(revenue.mrr, revenue.currency) : "—"}
            detail={
              revenue
                ? `${plural(revenue.subscribers, "abonné")} · ${formatMoney(revenue.revenue30d, revenue.currency)} sur 30 j`
                : !payment
                  ? "Paiements pas connectés"
                  : payment.livemode
                    ? "Pas encore synchronisé"
                    : "Compte de test"
            }
          />
          <Figure
            label="Vidéos TikTok"
            value={formatInteger(tiktok.videos)}
            detail={tiktok.accounts.length ? `${tiktok.videos30d} sur 30 j · ${formatCompact(tiktok.views30d)} vues` : "Aucun compte suivi"}
          />
          <Figure
            label={`Discussions avec ${COACH_NAME}`}
            value={formatInteger(discussions.total)}
            detail={lastDiscussion ? `${plural(discussionMessages, "message")} · ${formatAgoShort(lastDiscussion.updatedAt)}` : "Jamais"}
            onClick={
              lastDiscussion
                ? () => discussionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                : undefined
            }
          />
          <Figure label="Carrousels" value={formatInteger(saas.carousels)} detail="Créés sur MakeSaaS" />
        </div>
      </Section>

      <Section
        title={`Discussions avec ${COACH_NAME}${discussions.total ? ` · ${formatInteger(discussions.total)}` : ""}`}
        sectionRef={discussionsRef}
      >
        <DiscussionList discussions={discussions} onOpen={onOpenDiscussion} />
      </Section>

      <Section title={`Tâches faites${progress.tasksDone.length ? ` · ${progress.tasksDone.length}` : ""}`}>
        <DoneTaskList tasks={progress.tasksDone} />
      </Section>

      <Section title="Projet">
        <InfoRows rows={project} />
      </Section>

      <Section title="Connexions">
        <InfoRows
          rows={[
            {
              label: "Paiements",
              value: payment ? (
                <div className="space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {REVENUE_PROVIDER_NAMES[payment.provider]}
                      {payment.accountName && ` · ${payment.accountName}`}
                    </span>
                    <Badge variant={payment.livemode ? "default" : "secondary"} className="px-1.5 py-0 text-[11px]">
                      {payment.livemode ? "Réel" : "Test"}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {payment.lastSyncedAt ? `Dernière synchro : ${formatAgoShort(payment.lastSyncedAt)}` : "Jamais synchronisé"}
                  </p>
                  {payment.lastError && <p className="text-xs text-destructive">{payment.lastError}</p>}
                </div>
              ) : (
                <span className="text-muted-foreground">Aucun compte connecté</span>
              ),
            },
            {
              label: "TikTok",
              value: tiktok.accounts.length ? (
                <div className="space-y-1">
                  {tiktok.accounts.map((account) => (
                    <p key={account.handle}>
                      <a
                        href={`https://www.tiktok.com/@${encodeURIComponent(account.handle)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        @{account.handle}
                      </a>
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatCompact(account.followers)} abonnés{account.isPrivate && " · privé"}
                      </span>
                      {account.syncError && <span className="block text-xs text-destructive">{account.syncError}</span>}
                    </p>
                  ))}
                  {tiktok.lastPostAt && (
                    <p className="text-xs text-muted-foreground">Dernière vidéo : {formatAgoShort(tiktok.lastPostAt)}</p>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">Aucun compte suivi</span>
              ),
            },
          ]}
        />
      </Section>
    </>
  );
}

/** A key figure; with `onClick`, a button leading to what it counts. */
function Figure({ label, value, detail, onClick }: { label: string; value: string; detail: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>
        {detail}
      </p>
    </>
  );
  const frame = "min-w-0 rounded-xl border border-border/60 p-4";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${frame} text-left transition-colors hover:border-border hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}
