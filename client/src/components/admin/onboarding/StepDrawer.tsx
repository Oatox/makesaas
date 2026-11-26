import type { KeyboardEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MAX_ANSWER_KEYS, type OnboardingAnswerStat, type OnboardingStatsPeriod } from "@shared/admin";
import { plural, Section } from "@/components/admin/users/details/SaasDrawer";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOnboardingScreen } from "@/hooks/use-admin-onboarding";
import { cn } from "@/lib/utils";
import { DeviceBreakdown } from "./DeviceBreakdown";
import type { StepRow } from "./OnboardingSteps";
import { screenKind } from "./screen-names";
import { countChoices, isWrittenAnswer, screenQuestions, type ScreenQuestion } from "./screen-questions";

const tenths = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** "7,5 s", "24 s", "1 min 12 s", "1 h 5 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 10) return `${tenths.format(seconds)} s`;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  if (total < 3600) return total % 60 ? `${Math.floor(total / 60)} min ${total % 60} s` : `${total / 60} min`;
  const minutes = Math.round((total % 3600) / 60);
  return minutes ? `${Math.floor(total / 3600)} h ${minutes} min` : `${Math.floor(total / 3600)} h`;
}

type StepDrawerProps = {
  days: OnboardingStatsPeriod;
  rows: StepRow[];
  /** The row shown; null: closed. */
  index: number | null;
  /** The visitors who finished the onboarding: what comes after its last screen. */
  completed: number;
  /** The rows flagged among the biggest drops (their index). */
  drops: Map<number, number>;
  onIndexChange: (index: number | null) => void;
};

/**
 * A step of the list in a drawer: its visitors, those who left there, the time they stay on it (median),
 * its branches, the answers to its questions (read from Amplitude when it opens) and its figures per
 * kind of device. The steps before and after open with the arrows (← → too).
 */
export function StepDrawer({ index, rows, onIndexChange, ...props }: StepDrawerProps) {
  const row = index !== null ? rows[index] : undefined;
  const go = (next: number) => next >= 0 && next < rows.length && onIndexChange(next);
  const onKeyDown = (event: KeyboardEvent) => {
    if (index === null || event.defaultPrevented) return;
    if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "ArrowRight") go(index + 1);
  };

  return (
    <Sheet open={row !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <SheetContent side="right" className="overflow-y-auto p-5 sm:max-w-xl sm:p-7" onKeyDown={onKeyDown}>
        {row && index !== null && (
          <>
            <SheetTitle className="sr-only">{row.names[0]}</SheetTitle>
            <SheetDescription className="sr-only">Le détail de cette étape de l'onboarding.</SheetDescription>
            <StepDetail key={row.key} index={index} rows={rows} onGo={go} {...props} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StepDetail({
  days,
  rows,
  index,
  completed,
  drops,
  onGo,
}: Omit<StepDrawerProps, "index" | "onIndexChange"> & { index: number; onGo: (index: number) => void }) {
  const row = rows[index];
  const previous = rows[index - 1] as StepRow | undefined;
  const following = rows[index + 1] as StepRow | undefined;
  const isLanding = row.number === null;
  const isLast = !isLanding && !following;
  const lastNumber = rows[rows.length - 1].number ?? 0;

  // Those who did not reach what comes after: the next screen, or the end of the onboarding.
  const lost = Math.max(0, row.users - (following ? following.users : completed));
  // The list flags the step after the drop: its visitors left on this screen.
  const lostFlagged = drops.has(index + 1);

  const variants = row.variants.map((variant) => ({ ...variant, questions: screenQuestions(variant.stepId) }));
  const keys = Array.from(new Set(variants.flatMap((variant) => variant.questions.map((question) => question.key)))).slice(0, MAX_ANSWER_KEYS);
  const screen = useAdminOnboardingScreen(days, { number: row.number ?? 0, last: isLast, keys });
  const answers = new Map(screen.data?.answers.map((answer) => [answer.key, answer]));
  const kind = row.variants[0] ? screenKind(row.variants[0].stepId) : null;
  const written = row.variants.some((variant) => isWrittenAnswer(variant.stepId));
  // A single question titled like the screen needs no heading of its own.
  const askedQuestions = variants.flatMap((variant) => variant.questions.map((question) => ({ variant, question })));
  const headed = askedQuestions.length > 1 || variants.length > 1;

  const time = screen.isPending ? null : screen.data?.medianSeconds;
  const figures: { label: string; value: ReactNode; detail: string; alert?: boolean }[] = [
    {
      label: isLanding ? "Visiteurs" : "Arrivés",
      value: formatCount(row.users),
      detail: !previous ? "ont vu la landing" : previous.users ? `${formatRate(row.users / previous.users)} de l'étape d'avant` : "—",
    },
    {
      label: isLanding ? "Partis sans commencer" : "Partis ici",
      value: formatCount(lost),
      detail: row.users ? `${formatRate(lost / row.users)} ${isLanding ? "des visiteurs" : "des arrivés"}` : "—",
      alert: lostFlagged && lost > 0,
    },
    {
      label: isLanding ? "Avant de commencer" : "Temps passé",
      value: screen.isPending ? <Skeleton className="h-8 w-16" /> : time != null ? formatDuration(time) : "—",
      detail: isLanding ? "médiane, jusqu'au 1er écran" : isLast ? "médiane, jusqu'à la fin" : "médiane, jusqu'à l'écran suivant",
    },
    ...(isLanding
      ? []
      : [
          {
            label: "Depuis la landing",
            value: rows[0].users ? formatRate(row.users / rows[0].users) : "—",
            detail: "des visiteurs de la landing",
          },
        ]),
  ];

  return (
    <div className="space-y-7">
      <header className="pr-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {isLanding ? "Avant l'onboarding" : `Étape ${String(row.number).padStart(2, "0")} sur ${lastNumber}`}
          {kind && <span className="text-muted-foreground"> · {kind}</span>}
        </p>
        <h2 className="mt-1 font-display text-2xl font-light leading-tight">{row.names[0]}</h2>
        {variants.length > 1 && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            L'écran change selon la réponse à l'étape d'avant : {variants.length} variantes.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onGo(index - 1)} disabled={index === 0}>
            <ChevronLeft className="h-4 w-4" />
            Précédente
          </Button>
          <Button variant="outline" size="sm" onClick={() => onGo(index + 1)} disabled={!following}>
            Suivante
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className={cn("grid grid-cols-2 gap-3", isLanding && "sm:grid-cols-3")}>
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 rounded-xl border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">{figure.label}</p>
            <div className={cn("mt-1 text-2xl font-semibold tabular-nums", figure.alert && "text-destructive")}>{figure.value}</div>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={figure.detail}>
              {figure.detail}
            </p>
          </div>
        ))}
      </div>

      {screen.isError && (
        <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-destructive">
          {screen.error.message}
          <Button variant="outline" size="sm" onClick={() => screen.refetch()} disabled={screen.isFetching}>
            Réessayer
          </Button>
        </div>
      )}

      {variants.length > 1 && (
        <Section title="Variantes">
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {variants.map((variant) => (
              <li key={variant.stepId} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="min-w-0 truncate text-sm" title={variant.name}>
                  {variant.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatCount(variant.users)}
                  <span className="ml-2 inline-block w-12 text-right text-xs text-muted-foreground">
                    {row.users ? formatRate(variant.users / row.users) : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {askedQuestions.length > 0 && (
        <Section title="Réponses">
          <div className="space-y-6">
            {askedQuestions.map(({ variant, question }) => (
              <AnswerBreakdown
                key={question.key}
                question={question}
                heading={headed ? question.title : null}
                note={variants.length > 1 ? plural(variant.users, "visiteur") : null}
                stat={answers.get(question.key)}
                loading={screen.isPending}
                failed={screen.isError}
              />
            ))}
          </div>
        </Section>
      )}

      {written && (
        <Section title="Réponses">
          <p className="text-sm text-muted-foreground">
            Réponse écrite : elle est gardée avec le profil du membre, jamais envoyée à Amplitude. Elle se lit sur la page de
            chaque membre.
          </p>
        </Section>
      )}

      <Section title="Par appareil">
        <DeviceBreakdown row={row} previous={previous} />
      </Section>
    </div>
  );
}

/** The answers to one question: each choice, its visitors and their share of those who answered. */
function AnswerBreakdown({
  question,
  heading,
  note,
  stat,
  loading,
  failed,
}: {
  question: ScreenQuestion;
  heading: string | null;
  note: string | null;
  stat: OnboardingAnswerStat | undefined;
  loading: boolean;
  failed: boolean;
}) {
  const respondents = stat?.respondents ?? 0;
  const choices = countChoices(question, stat?.values ?? [], respondents);
  const top = Math.max(0, ...choices.map((choice) => choice.users));
  const median = stat && question.median ? question.median(stat.values) : null;
  const summary = [
    plural(respondents, "réponse"),
    question.multiple && "plusieurs choix possibles",
    median && `médiane : ${median}`,
  ].filter(Boolean);

  return (
    <div>
      {heading && (
        <h4 className="text-sm font-medium">
          {heading}
          {note && <span className="font-normal text-muted-foreground"> · {note}</span>}
        </h4>
      )}
      {loading ? (
        <div className="mt-2 space-y-3" aria-busy="true" aria-label="Chargement des réponses">
          <Skeleton className="h-3 w-24" />
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-8 w-full" />
          ))}
        </div>
      ) : failed ? null : (
        <>
          <p className={cn("text-xs text-muted-foreground", heading && "mt-0.5")}>{summary.join(" · ")}</p>
          {respondents === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Personne n'a encore répondu sur cette période.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {choices.map((choice) => {
                const Icon = choice.icon;
                const isTop = choice.users === top;
                return (
                  <li key={choice.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                      <span className={cn("truncate", choice.users === 0 && "text-muted-foreground")} title={choice.label}>
                        {choice.label}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">
                      {formatCount(choice.users)}
                      <span className="ml-2 inline-block w-12 text-right text-xs text-muted-foreground">{formatRate(choice.share)}</span>
                    </span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn("block h-full rounded-full", isTop ? "bg-primary" : "bg-foreground/45")}
                        style={{ width: `${choice.share * 100}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
