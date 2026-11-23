import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Clock, Loader2, Lock, Undo2, Zap } from "lucide-react";
import {
  missionBlocker,
  stageProgress,
  ticksAfter,
  type MissionAt,
  type RoadmapMission,
  type RoadmapStage,
  type RoadmapState,
} from "@shared/roadmap";
import { missionCheckText, missionTime, roadmapStagesFor, stageTimeLeft } from "@shared/roadmap-missions";
import type { Saas } from "@shared/saas";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { CoachMarkdown } from "@/components/coach/CoachMarkdown";
import { Button } from "@/components/ui/button";
import { useAskGus } from "@/hooks/use-ask-gus";
import { useTickMission } from "@/hooks/use-roadmap";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StepActionButton } from "./StepAction";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** "Bloqué ? Demande à Gus": a new discussion naming the mission (Gus knows its steps). */
function AskGusAbout({ mission, stage, saas }: { mission: RoadmapMission; stage: RoadmapStage; saas: Saas }) {
  const askGus = useAskGus();
  return (
    <button
      type="button"
      onClick={() =>
        askGus(saas.id, `Je suis sur la mission « ${mission.title} » (étape « ${stage.title} » de ma roadmap). Aide-moi à la réaliser, pas à pas.`)
      }
      className="mx-auto flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
    >
      <CoachAvatar className="h-6 w-6" /> Bloqué ? <span className="font-medium text-primary">Demande à {COACH_NAME}</span>
    </button>
  );
}

/**
 * A mission that waits for one before it (missionBlocker): instead of its steps, a lock and what to
 * finish first, with "Y aller", which opens that mission in this stage or in its own. When it is in
 * an earlier stage, the whole stage is locked.
 */
function LockedMission({
  mission,
  blocker,
  stage,
  onPickMission,
  onOpenStage,
}: {
  mission: RoadmapMission;
  blocker: MissionAt;
  stage: RoadmapStage;
  onPickMission: (key: string) => void;
  onOpenStage?: (index: number) => void;
}) {
  const sameStage = blocker.stage.key === stage.key;
  const open = sameStage ? () => onPickMission(blocker.mission.key) : onOpenStage ? () => onOpenStage(blocker.stageIndex) : null;
  const first = `«\u00a0${blocker.mission.title}\u00a0»`;
  return (
    <div className="rounded-2xl border border-border bg-background/40 px-5 py-9 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Lock className="h-5 w-5" />
      </span>
      <p className="mt-4 text-lg font-semibold">{sameStage ? mission.title : "Étape verrouillée"}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {sameStage ? `Termine d'abord ${first} pour la débloquer.` : `Termine d'abord ${first}, à l'étape ${blocker.stageIndex + 1}, pour la débloquer.`}
      </p>
      {open && (
        <Button variant="secondary" className="mt-5" onClick={open}>
          Y aller <ArrowRight />
        </Button>
      )}
    </div>
  );
}

/**
 * The mission to do now: its steps as a short numbered list, each with its button right under it,
 * nothing to click to move on. Then a single "C'est fait" for a mission the member ticks, or, for one
 * checked from the data, what it waits for (the roadmap checks it again each time it loads).
 */
function FocusedMission({
  mission,
  stage,
  stages,
  saas,
  state,
  onPickMission,
  onOpenStage,
}: {
  mission: RoadmapMission;
  stage: RoadmapStage;
  stages: RoadmapStage[];
  saas: Saas;
  state: RoadmapState;
  onPickMission: (key: string) => void;
  onOpenStage?: (index: number) => void;
}) {
  const { toast } = useToast();
  const tick = useTickMission(saas.id);
  const done = state.done[mission.key];
  const manual = mission.check.kind === "manual";
  // A mission waits for the ones before it: locked, it shows what to finish first instead of its steps.
  const blocker = done ? null : missionBlocker(stages, state.done, mission.key);
  // Unticking it also unticks the missions ticked after it: confirmed first when there are some.
  const later = ticksAfter(stages, state.done, mission.key);
  const [confirming, setConfirming] = useState(false);
  const time = missionTime(mission);

  const onError = () => toast({ variant: "destructive", title: "Impossible d'enregistrer", description: "Réessaie dans un instant." });
  const setDone = (value: boolean) => tick.mutate({ mission: mission.key, done: value }, { onError });
  const untick = () => tick.mutate({ mission: mission.key, done: false, also: later }, { onError, onSettled: () => setConfirming(false) });

  if (blocker) {
    return <LockedMission mission={mission} blocker={blocker} stage={stage} onPickMission={onPickMission} onOpenStage={onOpenStage} />;
  }

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4 sm:p-5">
      <p className={cn("text-xs font-semibold", done ? "text-primary" : "text-muted-foreground")}>{done ? "Mission accomplie" : "Maintenant"}</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug">{mission.title}</h3>
        {time && (
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/80">
            <Clock className="h-3.5 w-3.5" />
            {time}
          </span>
        )}
      </div>

      <ol className="mt-5">
        {mission.steps.map((step, index) => (
          <li key={index} className="relative flex gap-3.5 pb-5 last:pb-0">
            {/* The line down to the next step. */}
            {index < mission.steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[13px] top-8 w-px bg-border" />}
            <span
              className={cn(
                "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                done ? "bg-primary/15 text-primary" : "border border-primary/40 bg-primary/10 text-primary",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-3 pt-0.5">
              <CoachMarkdown text={step.text} className="text-sm leading-6" />
              {step.action && <StepActionButton action={step.action} saas={saas} state={state} />}
            </div>
          </li>
        ))}
      </ol>

      {done ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.07]">
          <div className="flex items-center gap-3 py-2.5 pl-2.5 pr-2">
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {done.source === "before" ? "Fait avant MakeSaaS" : `Fait le ${dayFormatter.format(new Date(done.at))}`}
              </p>
              <p className="text-xs text-muted-foreground">{done.source === "declared" ? "Coché par toi" : "Vu dans tes données"}</p>
            </div>
            {manual && done.source === "declared" && !confirming && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => (later.length ? setConfirming(true) : untick())}
                disabled={tick.isPending}
                className="shrink-0"
              >
                {tick.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />} Annuler
              </Button>
            )}
          </div>
          {confirming && (
            <div className="space-y-3 border-t border-primary/20 px-3 py-3">
              <p className="text-sm text-muted-foreground">
                {later.length > 1
                  ? `Tu as coché ${later.length} missions après celle-ci : elles seront annulées aussi.`
                  : "Tu as coché une mission après celle-ci : elle sera annulée aussi."}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="destructive" size="sm" onClick={untick} disabled={tick.isPending}>
                  {tick.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
                  Annuler les {later.length + 1} missions
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={tick.isPending}>
                  Garder
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : manual ? (
        <div className="mt-5 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => setDone(true)} disabled={tick.isPending} className="w-full">
            {tick.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            C'est fait
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-secondary/50 px-3.5 py-2.5">
          <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{missionCheckText(mission.check)}</p>
        </div>
      )}

      <div className="mt-4 flex">
        <AskGusAbout mission={mission} stage={stage} saas={saas} />
      </div>
    </div>
  );
}

/** The stage's other missions, still to do ("Ensuite") or done ("Terminées"): one opens on a click. */
function MissionList({
  title,
  missions,
  stage,
  stages,
  state,
  onPick,
}: {
  title: string;
  missions: RoadmapMission[];
  stage: RoadmapStage;
  stages: RoadmapStage[];
  state: RoadmapState;
  /** Opens a mission; without it (a locked stage), the list only shows what is to come. */
  onPick?: (key: string) => void;
}) {
  return (
    <div className="mt-6">
      <p className="px-1 text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="mt-2 overflow-hidden rounded-2xl border border-border">
        {missions.map((mission) => {
          const done = state.done[mission.key];
          const auto = mission.check.kind !== "manual";
          const locked = !done && missionBlocker(stages, state.done, mission.key) !== null;
          const time = missionTime(mission);
          const Row = onPick ? "button" : "div";
          return (
            <li key={mission.key} className="border-b border-border last:border-b-0">
              <Row
                {...(onPick ? { type: "button" as const, onClick: () => onPick(mission.key) } : {})}
                className={cn(
                  "flex w-full items-center gap-3 px-3.5 py-3 text-left",
                  onPick &&
                    "transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : stage.missions.indexOf(mission) + 1}
                </span>
                <span className={cn("min-w-0 flex-1 text-sm font-medium", done && "text-muted-foreground", locked && "text-foreground/60")}>
                  {mission.title}
                </span>
                {locked && <Lock aria-label="À faire après les missions d'avant" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                {!done && time && <span className="shrink-0 text-xs text-muted-foreground">{time}</span>}
                {!done && auto && !locked && <Zap aria-label="Se coche tout seul" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Every mission of the stage is done: it says so, and opens the next stage. */
function StageComplete({ stage, onNext }: { stage: RoadmapStage; onNext?: () => void }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] px-5 py-7 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-6 w-6" strokeWidth={3} />
      </span>
      <p className="mt-3 text-lg font-semibold">Étape terminée</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{stage.detail}</p>
      {onNext && (
        <Button className="mt-5" onClick={onNext}>
          Étape suivante <ArrowRight />
        </Button>
      )}
    </div>
  );
}

/**
 * A stage of the roadmap, in guided mode: the mission to do now in front (FocusedMission, one step at
 * a time), then the others in short lists. The member does missions in the roadmap's order
 * (missionBlocker): one waiting for another shows a lock instead of its steps, and a stage waiting for
 * an earlier one shows that lock, then its missions to come. A mission done while the drawer is open is celebrated, and the
 * next one comes in front. Shown in the roadmap's drawer (pages/Roadmap.tsx); `onOpenStage` opens
 * another stage there.
 */
export function StageDetail({
  stage,
  index,
  isCurrent,
  saas,
  state,
  onOpenStage,
}: {
  stage: RoadmapStage;
  index: number;
  isCurrent: boolean;
  saas: Saas;
  state: RoadmapState;
  onOpenStage?: (index: number) => void;
}) {
  const { toast } = useToast();
  const stages = useMemo(() => roadmapStagesFor(state.goal), [state.goal]);
  const progress = stageProgress(stage, state.done);
  // The mission in front: the one picked in the lists, or the first one still to do.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const focused =
    stage.missions.find((mission) => mission.key === focusKey) ?? stage.missions.find((mission) => !state.done[mission.key]) ?? null;
  const upcoming = stage.missions.filter((mission) => mission !== focused && !state.done[mission.key]);
  const finished = stage.missions.filter((mission) => mission !== focused && state.done[mission.key]);
  const hasNextStage = index + 1 < stages.length;
  const focusedBlocker = focused && !state.done[focused.key] ? missionBlocker(stages, state.done, focused.key) : null;
  const stageLocked = focusedBlocker !== null && focusedBlocker.stage.key !== stage.key;
  const timeLeft = stageTimeLeft(stage, state.done);

  // A mission done while the drawer is open (ticked, or seen in the data): celebrated, then the next comes in front.
  const doneKeys = stage.missions.filter((mission) => state.done[mission.key]).map((mission) => mission.key);
  const doneSignature = doneKeys.join(",");
  const seen = useRef(new Set(doneKeys));
  useEffect(() => {
    const fresh = doneKeys.filter((key) => !seen.current.has(key));
    seen.current = new Set(doneKeys);
    if (!fresh.length) return;
    const next = stage.missions.find((mission) => !state.done[mission.key]);
    toast({ title: "Mission accomplie", description: next ? `Prochaine : « ${next.title} ».` : "Étape terminée, bravo !" });
    setFocusKey((key) => (key && fresh.includes(key) ? null : key));
    // Runs when a mission of the stage gets done or undone, not on every new state object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneSignature]);

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Étape {index + 1} sur {stages.length}
        {progress.complete ? " · Terminée" : isCurrent ? " · En cours" : ""}
      </p>
      <h2 className="mt-2 pr-10 font-display text-2xl font-light leading-tight sm:text-[28px]">{stage.title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{stage.detail}</p>

      <div aria-hidden className="mt-4 flex gap-1.5">
        {stage.missions.map((mission) => (
          <span
            key={mission.key}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-500",
              state.done[mission.key] ? "bg-primary" : mission === focused && !focusedBlocker ? "bg-primary/35" : "bg-secondary",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {progress.done} mission{progress.done > 1 ? "s" : ""} sur {progress.total}
        {timeLeft && ` · encore ${timeLeft}`}
      </p>

      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={focused?.key ?? "complete"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
          >
            {focused ? (
              <FocusedMission
                mission={focused}
                stage={stage}
                stages={stages}
                saas={saas}
                state={state}
                onPickMission={setFocusKey}
                onOpenStage={onOpenStage}
              />
            ) : (
              <StageComplete stage={stage} onNext={hasNextStage && onOpenStage ? () => onOpenStage(index + 1) : undefined} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {stageLocked ? (
        // A locked stage: the lock, then every mission it holds, to see what is to come.
        <MissionList title="Au programme" missions={stage.missions} stage={stage} stages={stages} state={state} />
      ) : (
        <>
          {upcoming.length > 0 && (
            <MissionList title="Ensuite" missions={upcoming} stage={stage} stages={stages} state={state} onPick={setFocusKey} />
          )}
          {finished.length > 0 && (
            <MissionList title="Terminées" missions={finished} stage={stage} stages={stages} state={state} onPick={setFocusKey} />
          )}
        </>
      )}
    </section>
  );
}
