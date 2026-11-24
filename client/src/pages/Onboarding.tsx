import { useMemo } from "react";
import { Link, Redirect } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detailKey, visibleSteps, type OnboardingStep } from "@/components/onboarding/steps";
import { SingleChoiceStep } from "@/components/onboarding/SingleChoiceStep";
import { MultiChoiceStep } from "@/components/onboarding/MultiChoiceStep";
import { SliderStep } from "@/components/onboarding/SliderStep";
import { WheelStep } from "@/components/onboarding/WheelStep";
import { TextStep } from "@/components/onboarding/TextStep";
import { LoadingStep } from "@/components/onboarding/LoadingStep";
import { SocialProofStep } from "@/components/onboarding/SocialProofStep";
import { FounderProfileStep } from "@/components/onboarding/FounderProfileStep";
import { PotentialStep } from "@/components/onboarding/PotentialStep";
import { MethodStep } from "@/components/onboarding/MethodStep";
import { AccountStep } from "@/components/onboarding/AccountStep";
import { MessageStep } from "@/components/onboarding/MessageStep";
import { ChatStep } from "@/components/onboarding/ChatStep";
import { StatementStep } from "@/components/onboarding/StatementStep";
import { FeaturesStep } from "@/components/onboarding/FeaturesStep";
import { FutureStep } from "@/components/onboarding/FutureStep";
import { StoriesStep } from "@/components/onboarding/StoriesStep";
import { CurveStep } from "@/components/onboarding/CurveStep";
import { OneThingStep } from "@/components/onboarding/OneThingStep";
import { PactStep } from "@/components/onboarding/PactStep";
import { CoachChatStep } from "@/components/onboarding/CoachChatStep";
import { BuildStep } from "@/components/onboarding/BuildStep";
import { ProjectionStep } from "@/components/onboarding/ProjectionStep";
import { STEP_TITLE_CLASS, stepAppear as appear } from "@/components/onboarding/StepHeader";
import { TypewriterText } from "@/components/onboarding/TypewriterText";
import { useOnboardingProgress } from "@/hooks/use-onboarding";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_CONFIG } from "@/config/auth";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";

// The step container only handles the exit; its content appears piece by piece (title, then each card).
const stepMotion = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, x: -24, filter: "blur(6px)", transition: { duration: 0.2 } },
};

// Answers are a string (single choice) or a list (multiple choice): read each as the step expects.
const singleAnswer = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
const multiAnswer = (value: string | string[] | undefined) => (Array.isArray(value) ? value : []);

const countSteps = (answers: OnboardingAnswers) => visibleSteps(answers).length;

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Progression de l'onboarding"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
    >
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={false}
        animate={{ width: `${Math.max(value, 0.04) * 100}%` }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
      />
    </div>
  );
}

/** End of the onboarding: the paywall page once signed in, otherwise the way to create the account first. */
function EndStep({ isSignedIn, onReset }: { isSignedIn: boolean; onReset: () => void }) {
  if (isSignedIn) return <Redirect to={AUTH_CONFIG.SUBSCRIBE_PATH} replace />;

  return (
    <motion.div className="space-y-7" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>
      <div className="space-y-2">
        <h1 className={STEP_TITLE_CLASS}>
          <TypewriterText text="Ton plan est prêt !" />
        </h1>
        <motion.p variants={appear} className="text-base text-muted-foreground">
          Crée ton compte pour sauvegarder ta progression et débloquer ton plan.
        </motion.p>
      </div>
      <motion.div variants={appear} className="flex flex-col gap-3">
        <Button asChild className="h-12 text-base">
          <Link href={AUTH_CONFIG.REGISTER_PATH}>Créer mon compte</Link>
        </Button>
        <Button variant="ghost" className="h-11 text-muted-foreground" onClick={onReset}>
          Recommencer
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default function OnboardingPage() {
  const { user, hasAccess, isLoading } = useAuth();
  // Some steps only show for some answers (why the visitor never launched, gave up...): the saved
  // index points into the steps shown.
  const { progress, answer, next, back, reset } = useOnboardingProgress(countSteps);
  const answers = progress.answers;
  const steps = useMemo(() => visibleSteps(answers), [answers]);

  // Subscribers have nothing to do here.
  if (!isLoading && hasAccess) {
    return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;
  }

  const total = steps.length;
  const stepIndex = progress.stepIndex;
  const step = steps[stepIndex];
  const isDone = stepIndex >= total;
  const text = (key: string) => singleAnswer(answers[key]);
  const moveOn = () => next();
  // Once signed in, the account step is behind: going back jumps over it.
  const goBack = () => back(steps[stepIndex - 1]?.type === "account" && user ? 2 : 1);

  const renderStep = (step: OnboardingStep) => {
    switch (step.type) {
      case "single-choice":
        return (
          <SingleChoiceStep
            step={step}
            initial={text(step.id)}
            initialDetail={text(detailKey(step.id))}
            onAnswer={(value, detail) => answer(step.id, value, detail === undefined ? undefined : { [detailKey(step.id)]: detail })}
          />
        );
      case "multi-choice":
        return (
          <MultiChoiceStep
            step={step}
            options={(step.optionsBy && step.optionsBy.options[text(step.optionsBy.step) ?? ""]) || step.options}
            initial={multiAnswer(answers[step.id])}
            initialDetail={text(detailKey(step.id))}
            onAnswer={(values, detail) => answer(step.id, values, { [detailKey(step.id)]: detail })}
          />
        );
      case "slider":
        return <SliderStep step={step} initial={Number(text(step.id)) || undefined} onAnswer={(value) => answer(step.id, value)} />;
      case "wheel":
        return <WheelStep step={step} initial={Number(text(step.id)) || undefined} onAnswer={(value) => answer(step.id, value)} />;
      case "text":
        return <TextStep step={step} initial={text(step.id)} onAnswer={(value) => answer(step.id, value)} />;
      case "loading":
        return <LoadingStep step={step} answers={answers} onContinue={next} />;
      case "social-proof":
        return <SocialProofStep answers={answers} onContinue={moveOn} />;
      case "founder-profile":
        return <FounderProfileStep answers={answers} onContinue={moveOn} />;
      case "potential":
        return <PotentialStep answers={answers} onContinue={moveOn} />;
      case "method":
        return <MethodStep answers={answers} onContinue={moveOn} />;
      case "account":
        return <AccountStep onDone={moveOn} />;
      case "message":
        return <MessageStep step={step} onContinue={moveOn} />;
      case "chat":
        return <ChatStep step={step} answers={answers} onContinue={moveOn} />;
      case "statement":
        return <StatementStep title={step.title} onContinue={moveOn} />;
      case "features":
        return <FeaturesStep step={step} answers={answers} onContinue={moveOn} />;
      case "future":
        return <FutureStep answers={answers} onContinue={moveOn} />;
      case "stories":
        return <StoriesStep onContinue={moveOn} />;
      case "curve":
        return <CurveStep answers={answers} onContinue={moveOn} />;
      case "one-thing":
        return <OneThingStep answers={answers} onContinue={moveOn} />;
      case "pact":
        return <PactStep answers={answers} onContinue={moveOn} />;
      case "coach-chat":
        return <CoachChatStep answers={answers} onContinue={moveOn} />;
      case "build":
        return <BuildStep step={step} answers={answers} onContinue={next} />;
      case "projection":
        return <ProjectionStep answers={answers} onContinue={moveOn} />;
    }
  };

  return (
    <div className="bg-grain relative flex min-h-[100svh] flex-col bg-background">
      {/* Back + progress on every screen, nothing else. Members sign in from the landing page. */}
      <header className="relative z-10 w-full px-5 pb-2 pt-5 sm:px-6 md:px-8 md:pt-7 md:[@media(max-height:820px)]:pt-5">
        <div className="flex items-center gap-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Question précédente"
              className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              data-testid="button-onboarding-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              href="/"
              aria-label="Retour à l'accueil"
              className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          )}
          <ProgressBar value={stepIndex / total} />
        </div>
      </header>

      {/* Desktop: wider column, still starting at the top. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 pb-10 pt-5 sm:px-6 sm:pt-6 md:max-w-[680px] md:pt-8 md:[@media(max-height:820px)]:pt-4 [@media(max-height:720px)]:pb-5">
        <AnimatePresence mode="wait">
          <motion.div key={isDone ? "done" : step.id} className="flex flex-1 flex-col" {...stepMotion}>
            {isDone ? <EndStep isSignedIn={!!user} onReset={reset} /> : renderStep(step)}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
