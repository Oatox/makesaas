import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import type { SaasIdea } from "@shared/ideas";
import { resumeLaunch } from "@shared/launch";
import { missionTime } from "@shared/roadmap-missions";
import { Logo } from "@/components/brand/Logo";
import { CoachThread, useCoachThread } from "@/components/ideas/CoachThread";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { IdeasLoader } from "@/components/ideas/IdeasLoader";
import { AppTour, PlanDialog, ProjectForm, firstMissionFor, inSentence } from "@/components/ideas/LaunchSteps";
import { ContinueButton } from "@/components/onboarding/ContinueButton";
import { StatementStep } from "@/components/onboarding/StatementStep";
import { euros, firstName, goalOf } from "@/components/onboarding/insights";
import { buildOnboardingProfile } from "@/components/onboarding/profile";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { AUTH_CONFIG } from "@/config/auth";
import { profileKeys, useAuth } from "@/hooks/use-auth";
import { isRunning, useIdeas, useSaveOnboardingProfile } from "@/hooks/use-ideas";
import { isSaasIdeaTaken, saasErrorMessage, saasKeys, useSaas } from "@/hooks/use-saas";
import { useSaveLaunchStep } from "@/hooks/use-launch";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { loadOnboardingProgress } from "@/lib/onboarding-storage";

const stagger = { initial: "hidden", animate: "visible", variants: { visible: { transition: { staggerChildren: 0.08 } } } } as const;

/** Where a member lands once they have a project. */
const APP_HOME = AUTH_CONFIG.REDIRECT_PATH;

/**
 * A series being waited for: the newest series with ideas and the latest series when it was asked,
 * when it was asked, and what the member sees meanwhile:
 * - `continue`: Gus's welcome, then "Continuer", which puts the loader up;
 * - `loader`: the loader (`title`), while Gus writes a new request;
 * - `cards`: the cards shown stay, replaced by the next ones already written (from stock, at once).
 */
type Awaiting = {
  ideasAfter: string | null;
  latestAfter: string | null;
  since: number;
  show: "continue" | "loader" | "cards";
  title: string;
};

/** The loader stays up this long at least, so ideas from stock (at once) do not just flash it. */
const MIN_SEARCH_MS = 1_200;

/**
 * Where the member is once the ideas are out: choosing one, confirming the project (name and
 * sentence: the SaaS is created there), seeing the plan, the tour of the app, then the first mission.
 */
type Stage = "ideas" | "project" | "plan" | "tour" | "mission";

/**
 * /lancement: a member enters the app here, right after paying, and stays until they have a SaaS (the
 * other pages send them back, see ProtectedRoute). Gus welcomes them like in the onboarding's chat,
 * then shows 3 app ideas made from their answers, the first being the one he recommends. The first
 * series is usually already being written: the payment webhook started it. "D'autres idées" asks for
 * 3 new ones. Keeping one leads to three last steps with Gus: confirming the project (the SaaS is
 * created then), seeing the plan to the member's goal, and the first mission of the roadmap (read from
 * it: firstMissionFor), which waits on Accueil, where the member enters the app.
 *
 * Each step is saved on the profile (shared/launch.ts, useSaveLaunchStep): a reload, a new sign-in or
 * another device opens the same step, and the app sends the member back here until the launch is over
 * (ProtectedRoute). The project, once confirmed, is locked: no going back to the ideas with a SaaS, the
 * server refuses them new ideas and the database another SaaS from an idea (enforce_saas_from_idea).
 */
export default function Launch() {
  const { user, profile } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { series, latest, isLoading, isError, retry, next, hasStock, isWriting, generateError } = useIdeas();
  const { saasList, currentSaas, isLoading: saasLoading, createSaas, isCreating } = useSaas();
  const hasProject = saasList.length > 0;
  const saveStep = useSaveLaunchStep();
  // The launch was over when the page opened: the app.
  const [leaving, setLeaving] = useState(false);
  const { lines, typing, idle, say, show, clear } = useCoachThread();

  // The series whose cards are shown (always the newest: no going back to the previous ones); null
  // while Gus talks or writes.
  const [shownId, setShownId] = useState<string | null>(null);
  // The conversation with Gus, or the ideas he wrote: opened as soon as a series waited for arrives,
  // or from "Voir mes idées" when the member comes back to ideas already written.
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
  // The monthly goal picked on this device, else the one saved on the profile (another device).
  const goal = typeof answers.revenu === "string" ? goalOf(answers) : (profile?.monthly_goal ?? goalOf(answers));

  const requestIdeas = useCallback(() => {
    const profileLines = buildOnboardingProfile(answers);
    next(profileLines.length ? { profile: profileLines } : {});
  }, [answers, next]);

  /** From now on, a new series with ideas is shown, a new failed one is said; `show` is what meanwhile. */
  const waitForSeries = (show: "loader" | "cards", title = "Gus cherche tes idées") => {
    if (show === "loader") setShownId(null);
    setFailed(false);
    setAwaiting({ ideasAfter: series[0]?.id ?? null, latestAfter: latest?.id ?? null, since: Date.now(), show, title });
  };

  // Arrival: back to the step saved (resumeLaunch), or Gus welcomes the member, then the ideas (being
  // written since the payment, or asked now).
  useEffect(() => {
    if (arrived.current || isLoading || isError || saasLoading) return;
    arrived.current = true;
    const hello = `Re${name ? ` ${name}` : ""} !`;
    const resume = resumeLaunch(profile?.launch_step ?? null, hasProject);
    const newest = series[0];
    const running = isRunning(latest);

    // The launch is over: the app.
    if (resume === "done") {
      setLeaving(true);
      return;
    }

    // The SaaS is created: its plan, the tour of the app or the first mission.
    if (resume === "plan" || resume === "tour" || resume === "mission") {
      setProjectName(currentSaas?.name ?? "");
      setStage(resume);
      if (resume === "plan") void say("coach", [hello, `Voici ton plan pour aller jusqu'à ${euros.format(goal)} par mois.`]);
      if (resume === "tour") tellTour([hello, "Avant ta première mission, je te fais faire le tour de l'app."]);
      return;
    }

    // The idea chosen, back on its name and sentence (the ideas otherwise, if it is not shown anymore).
    const chosenIdea =
      resume === "project" ? series.flatMap((item) => item.ideas).find((idea) => idea.id === profile?.launch_idea_id) : undefined;
    if (chosenIdea) {
      setShownId(newest?.id ?? null);
      openProject(chosenIdea, [hello, `Tu avais choisi ${chosenIdea.content.name}.`]);
      return;
    }

    // The ideas can be opened as soon as they exist, while Gus is still talking.
    if (newest && !running) {
      setShownId(newest.id);
      void say("coach", [
        hello,
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
            hello,
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
      since: Date.now(),
      show: "continue",
      title: "Gus cherche tes idées",
    });
    if (!running) requestIdeas();
  }, [isLoading, isError, saasLoading, hasProject, profile, currentSaas, goal, series, latest, name, say, requestIdeas]);

  // The series waited for has arrived: straight to the ideas, once Gus has finished talking and the
  // member has clicked "Continuer" (and the loader has been up for a moment); in place of the cards
  // shown, from the first one. Or it failed: Gus says so in the chat.
  useEffect(() => {
    if (!awaiting) return;
    const newest = series[0];
    if (newest && newest.id !== awaiting.ideasAfter && !isWriting) {
      if (!idle || awaiting.show === "continue") return;
      const inPlace = awaiting.show === "cards";
      const timer = window.setTimeout(
        () => {
          setAwaiting(null);
          setShownId(newest.id);
          setView("ideas");
          if (inPlace) window.scrollTo({ top: 0, behavior: "smooth" });
        },
        inPlace ? 0 : Math.max(0, awaiting.since + MIN_SEARCH_MS - Date.now()),
      );
      return () => window.clearTimeout(timer);
    }
    const latestFailed = latest?.status === "failed" && latest.id !== awaiting.latestAfter;
    if (!isWriting && (generateError || latestFailed)) {
      setAwaiting(null);
      setFailed(true);
      setView("chat");
      void say("coach", [generateError ? generateError.message : "Je n'ai pas réussi à finir tes idées.", "On réessaie ?"]);
    }
  }, [awaiting, series, latest, isWriting, generateError, idle, say]);

  // Follow the conversation; the ideas open from their top.
  useEffect(() => {
    if (view === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, typing, view]);
  useEffect(() => {
    if (view === "ideas") window.scrollTo({ top: 0 });
  }, [view]);

  // The next ideas: already written, they replace the cards at once; otherwise the loader while Gus
  // writes new ones.
  const askMore = () => {
    if (hasStock) {
      waitForSeries("cards");
    } else {
      window.scrollTo({ top: 0 });
      waitForSeries("loader", "Gus cherche d'autres idées");
    }
    requestIdeas();
  };

  const tryAgain = () => {
    void say("you", ["On réessaie !"]);
    waitForSeries("loader");
    requestIdeas();
  };

  // Step 1: the chosen idea in a chat that starts from it (the welcome is gone), to confirm its name and
  // sentence. Also where a member who had chosen it comes back (`coachLines` then greet them).
  const openProject = (idea: SaasIdea, coachLines: string[]) => {
    setChosen(idea);
    setProjectName(idea.content.name);
    setProjectPitch(idea.content.pitch);
    setStage("project");
    setView("chat");
    void say("coach", [
      ...coachLines,
      `On garde le nom ${idea.content.name} ? Tu peux le changer, et ajuster la phrase qui dit ce que fait ton app.`,
    ]);
  };

  const keep = (idea: SaasIdea) => {
    void saveStep("project", idea.id);
    clear();
    void say("you", [`Je garde ${idea.content.name} !`]);
    openProject(idea, ["Super choix !"]);
  };

  const backToIdeas = () => {
    void saveStep(null);
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
      void saveStep("plan");
      // The plan opens over the chat once Gus has said it.
      setStage("plan");
      void say("you", [`C'est bon pour ${created.name}.`]);
      void say("coach", [`${created.name} est lancé !`, `Voici ton plan pour aller jusqu'à ${euros.format(goal)} par mois.`]);
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Impossible de créer ton projet") });
      // Chosen meanwhile in another tab: with its SaaS and step read again, the app sends the member
      // where that launch is (ProtectedRoute, then this page again if it is not over).
      if (isSaasIdeaTaken(error) && user) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: saasKeys.list(user.id) }),
          queryClient.refetchQueries({ queryKey: profileKeys.detail(user.id) }),
        ]);
        navigate(APP_HOME, { replace: true });
      }
    } finally {
      setKeepingId(null);
    }
  };

  // The tour of the app by Gus, before the first mission (`opening`: his first lines).
  const tellTour = (opening: string[]) => {
    void say("coach", opening);
    void show(<AppTour />);
    void say("coach", ["Tout ça est dans le menu, et je reste avec toi à chaque étape."]);
  };

  // Step 3, from the plan's "Et maintenant ?": a new conversation with Gus (the one before is gone),
  // who shows around the app before the first mission.
  const toTour = () => {
    void saveStep("tour");
    setStage("tour");
    clear();
    void say("you", ["Et maintenant ?"]);
    tellTour(["Avant ta première mission, je te fais faire le tour de l'app."]);
  };

  // Step 4, from "Compris": the first mission of the roadmap alone on screen, said by Gus like the
  // onboarding's statements (StatementStep), as its texts say it (title, then why and time).
  const toMission = () => {
    void saveStep("mission");
    setStage("mission");
  };
  const firstMission = useMemo(() => firstMissionFor(goal).mission, [goal]);
  const firstMissionTime = missionTime(firstMission);

  // "C'est parti": the launch is over, the app opens (once saved, so it does not send them back here).
  const enterApp = async () => {
    await saveStep("done");
    navigate(APP_HOME);
  };

  const shown = series.find((item) => item.id === shownId) ?? null;
  const busy = isCreating || keepingId !== null;

  if (leaving) return <Redirect to={APP_HOME} replace />;

  return (
    <div className="bg-grain relative flex min-h-[100svh] flex-col bg-background">
      {/* No way out to the app until the launch is over: its last button ("C'est parti") enters it. */}
      <header className="relative z-10 flex w-full justify-center px-5 pt-5 sm:px-6 md:px-8 md:pt-7">
        <Logo />
      </header>

      {/* From the top, as in the onboarding: the column fills the screen, so "Voir mes idées" sits
          at its bottom. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[680px] flex-1 flex-col px-5 pb-10 pt-8 sm:px-6 md:pt-12">
        <div className="flex flex-1 flex-col">
        {isLoading || saasLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Impossible de charger tes idées"
            message="Vérifie ta connexion internet, puis réessaie."
            action={<Button onClick={retry}>Réessayer</Button>}
          />
        ) : awaiting?.show === "loader" && idle ? (
          // Gus has said what he had to say: the loader until the ideas are there.
          <IdeasLoader key={awaiting.since} title={awaiting.title} />
        ) : stage === "mission" ? (
          <StatementStep
            title={`Première mission\u00a0: ${inSentence(firstMission.title)}.`}
            subtitle={`${firstMission.why}${firstMissionTime ? ` Compte ${firstMissionTime}.` : ""}`}
            label="C'est parti"
            onContinue={() => void enterApp()}
          />
        ) : view === "ideas" && shown ? (
          <motion.div key="ideas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h1 className="font-display text-2xl font-light leading-tight sm:text-[32px]">Tes idées</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              La première, c'est celle que Gus te conseille. Garde celle qui te parle : elle deviendra ton projet.
            </p>
            {/* A new series: the cards leave, the next ones come in their place. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={shown.id}
                {...stagger}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)", transition: { duration: 0.25 } }}
                className="mt-6 space-y-3"
              >
                {shown.ideas.map((idea, index) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    recommended={index === 0}
                    keeping={keepingId === idea.id}
                    disabled={busy || awaiting !== null}
                    onKeep={() => keep(idea)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Pinned to the bottom of the screen while the cards scroll under it, back in place
                after the last one; the cards fade out behind it. */}
            <div className="sticky bottom-0 z-10 -mx-5 mt-2 bg-gradient-to-t from-background from-60% to-background/0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 sm:-mx-6 sm:px-6">
              <Button
                variant="secondary"
                className="h-11 w-full"
                onClick={askMore}
                disabled={isWriting || busy || awaiting !== null}
                data-testid="button-more-ideas"
              >
                {awaiting?.show === "cards" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                D'autres idées
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            <CoachThread lines={lines} typing={typing} />

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
                  className="mt-3 self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Choisir une autre idée
                </button>
              </>
            )}

            {failed && idle && !awaiting && stage === "ideas" && (
              <div className="mt-4 flex justify-end">
                <Button onClick={tryAgain}>
                  <RefreshCw /> Réessayer
                </Button>
              </div>
            )}

            <div ref={endRef} />

            {/* Gus's welcome read: the member moves on to the loader (or the ideas, already there). */}
            {stage === "ideas" && awaiting?.show === "continue" && idle && (
              <ContinueButton onClick={() => setAwaiting((current) => current && { ...current, show: "loader" })} />
            )}
            {/* Back to ideas already written: the onboarding's bottom button opens them on their own
                screen, only once their request to OneShotAPI is over: never while a series is being
                written (by this page, the payment webhook or another tab). */}
            {stage === "ideas" && shown && !awaiting && !isWriting && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-auto">
                <ContinueButton label="Voir mes idées" onClick={() => setView("ideas")} />
              </motion.div>
            )}
            {stage === "project" && idle && (
              <ContinueButton label="C'est bon" onClick={() => void confirmProject()} disabled={busy || !projectName.trim()} />
            )}
            {stage === "tour" && idle && <ContinueButton label="Compris" onClick={toMission} />}
          </>
        )}
        </div>
      </main>

      <PlanDialog open={stage === "plan" && idle} projectName={projectName.trim()} goal={goal} onContinue={toTour} />
    </div>
  );
}
