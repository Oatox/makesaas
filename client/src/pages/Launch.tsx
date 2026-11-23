import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import type { SaasIdea } from "@shared/ideas";
import { Logo } from "@/components/brand/Logo";
import { CoachThread, useCoachThread } from "@/components/ideas/CoachThread";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { PlanPreview, ProjectForm } from "@/components/ideas/LaunchSteps";
import { ContinueButton } from "@/components/onboarding/ContinueButton";
import { euros, firstName, goalOf } from "@/components/onboarding/insights";
import { buildOnboardingProfile } from "@/components/onboarding/profile";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { AUTH_CONFIG } from "@/config/auth";
import { useAuth } from "@/hooks/use-auth";
import { isRunning, useIdeas, useSaveOnboardingProfile } from "@/hooks/use-ideas";
import { saasErrorMessage, useSaas } from "@/hooks/use-saas";
import { useToast } from "@/hooks/use-toast";
import { loadOnboardingProgress } from "@/lib/onboarding-storage";

const stagger = { initial: "hidden", animate: "visible", variants: { visible: { transition: { staggerChildren: 0.08 } } } } as const;

/** Where a member lands once they have a project. */
const APP_HOME = AUTH_CONFIG.REDIRECT_PATH;

/** A series being waited for: the newest series with ideas and the latest series when it was asked, and what Gus says when it arrives. */
type Awaiting = { ideasAfter: string | null; latestAfter: string | null; arrival: string[] };

/**
 * Where the member is once the ideas are out: choosing one, confirming the project (name and
 * sentence: the SaaS is created there), seeing the plan, then the first mission.
 */
type Stage = "ideas" | "project" | "plan" | "mission";

/**
 * /lancement: a member enters the app here, right after paying, and stays until they have a SaaS (the
 * other pages send them back, see ProtectedRoute). Gus welcomes them like in the onboarding's chat,
 * then shows 3 app ideas made from their answers, the first being the one he recommends. The first
 * series is usually already being written: the payment webhook started it. "D'autres idées" asks for
 * 3 new ones. Keeping one leads to three last steps with Gus: confirming the project (the SaaS is
 * created then), seeing the plan to the member's goal, and the first mission: putting the app online,
 * whose tasks wait on Accueil, where the member enters the app.
 */
export default function Launch() {
  const { profile } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { series, latest, isLoading, isError, retry, next, isWriting, generateError } = useIdeas();
  const { saasList, createSaas, isCreating } = useSaas();
  const { lines, typing, idle, say } = useCoachThread();

  // The series whose cards are shown; null while Gus talks or writes.
  const [shownId, setShownId] = useState<string | null>(null);
  // The conversation with Gus, or the ideas he wrote, opened from "Voir mes idées".
  const [view, setView] = useState<"chat" | "ideas">("chat");
  const [awaiting, setAwaiting] = useState<Awaiting | null>(null);
  const [failed, setFailed] = useState(false);
  const [keepingId, setKeepingId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("ideas");
  const [chosen, setChosen] = useState<SaasIdea | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectPitch, setProjectPitch] = useState("");
  const arrived = useRef(false);
  // The answers and the monthly goal on the profile (already done by the paywall on this device).
  useSaveOnboardingProfile();
  const endRef = useRef<HTMLDivElement>(null);

  // The answers kept on this device since the onboarding; empty on another device (the server then
  // uses the ones saved from the paywall).
  const answers = useMemo(() => loadOnboardingProgress().answers, []);
  const onboardingName = firstName(answers);
  const name = (profile?.full_name ?? "").trim().split(/\s+/)[0] || (onboardingName !== "toi" ? onboardingName : "");

  const requestIdeas = useCallback(() => {
    const profileLines = buildOnboardingProfile(answers);
    next(profileLines.length ? { profile: profileLines } : {});
  }, [answers, next]);

  /** From now on, a new series with ideas is shown (after `arrival`), a new failed one is said. */
  const waitForSeries = (arrival: string[]) => {
    setShownId(null);
    setFailed(false);
    setAwaiting({ ideasAfter: series[0]?.id ?? null, latestAfter: latest?.id ?? null, arrival });
  };

  // Arrival: Gus welcomes the member, then the ideas (being written since the payment, or asked now).
  useEffect(() => {
    if (arrived.current || isLoading || isError) return;
    arrived.current = true;
    const newest = series[0];
    const running = isRunning(latest);

    // The ideas can be opened as soon as they exist, while Gus is still talking.
    if (newest && !running) {
      setShownId(newest.id);
      void say("coach", [
        `Re${name ? ` ${name}` : ""} !`,
        "Voici les dernières idées que je t'ai proposées. La première, c'est celle que je te conseille.",
        "Aucune ne te parle ? Je t'en propose d'autres.",
        "Quand tu en gardes une, elle devient ton projet et on s'y met ensemble.",
      ]);
      return;
    }

    void say(
      "coach",
      newest
        ? [
            `Re${name ? ` ${name}` : ""} !`,
            "Je termine tes nouvelles idées, encore quelques secondes.",
            "Comme pour les précédentes, je pars de tes réponses au questionnaire.",
          ]
        : [
            `Bienvenue sur MakeSaaS${name ? `, ${name}` : ""} !`,
            "On commence par le plus important : ton idée d'app.",
            "J'ai relu tes réponses au questionnaire : ton temps, tes envies et tes objectifs.",
            "Je te prépare tes idées, ça prend moins d'une minute.",
          ],
    );
    // A series running since the payment: wait for it (its failure counts too). Otherwise, ask now.
    setAwaiting({
      ideasAfter: newest?.id ?? null,
      latestAfter: running ? null : (latest?.id ?? null),
      arrival: [
        "Voilà ! La première, c'est celle que je te conseille.",
        "Garde celle qui te parle : elle deviendra ton projet. Si aucune ne te plaît, je t'en propose d'autres.",
      ],
    });
    if (!running) requestIdeas();
  }, [isLoading, isError, series, latest, name, say, requestIdeas]);

  // The series waited for has arrived, or failed.
  useEffect(() => {
    if (!awaiting) return;
    const newest = series[0];
    if (newest && newest.id !== awaiting.ideasAfter && !isWriting) {
      setAwaiting(null);
      setShownId(newest.id);
      void say("coach", awaiting.arrival);
      return;
    }
    const latestFailed = latest?.status === "failed" && latest.id !== awaiting.latestAfter;
    if (!isWriting && (generateError || latestFailed)) {
      setAwaiting(null);
      setFailed(true);
      void say("coach", [generateError ? generateError.message : "Je n'ai pas réussi à finir tes idées.", "On réessaie ?"]);
    }
  }, [awaiting, series, latest, isWriting, generateError, say]);

  // Follow the conversation; the ideas open from their top.
  useEffect(() => {
    if (view === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, typing, view]);
  useEffect(() => {
    if (view === "ideas") window.scrollTo({ top: 0 });
  }, [view]);

  // From the ideas, back to Gus, who writes the new ones.
  const askMore = () => {
    setView("chat");
    void say("you", ["Tu peux m'en proposer d'autres ?"]);
    waitForSeries(["En voilà 3 nouvelles. La première est toujours celle que je te conseille."]);
    requestIdeas();
  };

  const tryAgain = () => {
    void say("you", ["On réessaie !"]);
    waitForSeries(["C'est bon, les voilà ! La première, c'est celle que je te conseille."]);
    requestIdeas();
  };

  // Step 1: the kept idea, back in the chat, to confirm its name and sentence.
  const keep = (idea: SaasIdea) => {
    setChosen(idea);
    setProjectName(idea.content.name);
    setProjectPitch(idea.content.pitch);
    setStage("project");
    setView("chat");
    void say("you", [`Je garde ${idea.content.name} !`]);
    void say("coach", [
      "Super choix !",
      `On garde le nom ${idea.content.name} ? Tu peux le changer, et ajuster la phrase qui dit ce que fait ton app.`,
    ]);
  };

  const backToIdeas = () => {
    setStage("ideas");
    setView("ideas");
  };

  // The project confirmed: the SaaS is created, then step 2, the plan to the member's goal.
  const confirmProject = async () => {
    if (!chosen) return;
    setKeepingId(chosen.id);
    try {
      const created = await createSaas({
        name: projectName.trim(),
        description: projectPitch.trim() || null,
        audience: chosen.content.audience,
        idea_id: chosen.id,
      });
      setStage("plan");
      void say("you", [`C'est bon pour ${created.name}.`]);
      void say("coach", [
        `${created.name} est lancé !`,
        `Voici ton plan pour aller jusqu'à ${euros.format(goalOf(answers))} par mois. Chaque étape se cochera toute seule quand tu l'auras franchie.`,
      ]);
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Impossible de créer ton projet") });
    } finally {
      setKeepingId(null);
    }
  };

  // Step 3: the first mission.
  const toMission = () => {
    setStage("mission");
    void say("you", ["Et maintenant ?"]);
    void say("coach", ["Première mission : mettre ton app en ligne."]);
  };

  const shownIndex = series.findIndex((item) => item.id === shownId);
  const shown = shownIndex >= 0 ? series[shownIndex] : null;
  const busy = isCreating || keepingId !== null;

  return (
    <div className="bg-grain relative flex min-h-[100svh] flex-col bg-background">
      <header className="relative z-10 grid w-full grid-cols-[1fr_auto_1fr] items-center px-5 pt-5 sm:px-6 md:px-8 md:pt-7">
        <span />
        <Logo />
        {/* No way into the app without a project: only a member who has one can go back. */}
        {saasList.length > 0 ? (
          <Link
            href={APP_HOME}
            className="justify-self-end rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Retour à mon espace
          </Link>
        ) : (
          <span />
        )}
      </header>

      {/* From the top, as in the onboarding: the column fills the screen, so "Voir mes idées" sits
          at its bottom. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[680px] flex-1 flex-col px-5 pb-10 pt-8 sm:px-6 md:pt-12">
        <div className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Impossible de charger tes idées"
            message="Vérifie ta connexion internet, puis réessaie."
            action={<Button onClick={retry}>Réessayer</Button>}
          />
        ) : view === "ideas" && shown ? (
          <motion.div key="ideas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h1 className="font-display text-2xl font-light leading-tight sm:text-[32px]">Tes idées</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              La première, c'est celle que Gus te conseille. Garde celle qui te parle : elle deviendra ton projet.
            </p>
            <motion.div key={shown.id} {...stagger} className="mt-6 space-y-3">
              {shown.ideas.map((idea, index) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  recommended={index === 0}
                  keeping={keepingId === idea.id}
                  disabled={busy}
                  onKeep={() => keep(idea)}
                />
              ))}
            </motion.div>

            <div className="mt-8 space-y-4">
              <Button
                variant="secondary"
                className="h-11 w-full"
                onClick={askMore}
                disabled={isWriting || busy}
                data-testid="button-more-ideas"
              >
                <RefreshCw />
                D'autres idées
              </Button>

              {series.length > 1 && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Idées précédentes"
                    onClick={() => setShownId(series[shownIndex + 1]?.id ?? shown.id)}
                    disabled={shownIndex >= series.length - 1}
                  >
                    <ChevronLeft />
                  </Button>
                  <span>
                    Série {series.length - shownIndex} sur {series.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Idées suivantes"
                    onClick={() => setShownId(series[shownIndex - 1]?.id ?? shown.id)}
                    disabled={shownIndex <= 0}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            <CoachThread lines={lines} typing={typing || (awaiting !== null && idle)} />

            {/* The steps after an idea is kept, each once Gus has said it. */}
            {stage === "project" && idle && (
              <>
                <ProjectForm
                  name={projectName}
                  pitch={projectPitch}
                  onNameChange={setProjectName}
                  onPitchChange={setProjectPitch}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={backToIdeas}
                  disabled={busy}
                  className="mt-3 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Choisir une autre idée
                </button>
              </>
            )}
            {(stage === "plan" || stage === "mission") && idle && <PlanPreview projectName={projectName.trim()} goal={goalOf(answers)} />}

            {failed && idle && !awaiting && stage === "ideas" && (
              <div className="mt-4 flex justify-end">
                <Button onClick={tryAgain}>
                  <RefreshCw /> Réessayer
                </Button>
              </div>
            )}

            <div ref={endRef} />

            {/* The onboarding's bottom button opens the ideas on their own screen, only once their
                request to OneShotAPI is over: never while a series is being written (by this page,
                the payment webhook or another tab). */}
            {stage === "ideas" && shown && !awaiting && !isWriting && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-auto">
                <ContinueButton label="Voir mes idées" onClick={() => setView("ideas")} />
              </motion.div>
            )}
            {stage === "project" && idle && (
              <ContinueButton label="C'est bon" onClick={() => void confirmProject()} disabled={busy || !projectName.trim()} />
            )}
            {stage === "plan" && idle && <ContinueButton label="Et maintenant ?" onClick={toMission} />}
            {stage === "mission" && idle && (
              <ContinueButton label="Mettre mon app en ligne" onClick={() => navigate(APP_HOME)} />
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}
