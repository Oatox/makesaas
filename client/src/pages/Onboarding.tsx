import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STEPS, type SingleChoiceStep as SingleChoiceStepConfig } from "@/components/onboarding/steps";
import { BettingInsightStep } from "@/components/onboarding/BettingInsightStep";
import { SliderStep } from "@/components/onboarding/SliderStep";
import { SocialProofStep } from "@/components/onboarding/SocialProofStep";
import { GoalProjectionStep } from "@/components/onboarding/GoalProjectionStep";
import { MultiChoiceStep } from "@/components/onboarding/MultiChoiceStep";
import { ProfileSetupStep } from "@/components/onboarding/ProfileSetupStep";
import { Paywall } from "@/components/billing/Paywall";
import { optionCardClass, SelectionWash } from "@/components/onboarding/OptionCard";
import { StepHeader, STEP_TITLE_CLASS, stepAppear as appear } from "@/components/onboarding/StepHeader";
import { TypewriterText } from "@/components/onboarding/TypewriterText";
import { useOnboardingProgress } from "@/hooks/use-onboarding";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_CONFIG } from "@/config/auth";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

// Delay between the tap on an option and the next step, so the selection is visible.
const ADVANCE_DELAY_MS = 220;

// The step container only handles the exit; its content appears piece by piece (title, then each card).
const stepMotion = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, x: -24, filter: "blur(6px)", transition: { duration: 0.2 } },
};

// Answers are a string (single choice) or a list (multiple choice): read each as the step expects.
const singleAnswer = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
const multiAnswer = (value: string | string[] | undefined) => (Array.isArray(value) ? value : []);

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

function SingleChoiceStep({
  step,
  onAnswer,
}: {
  step: SingleChoiceStepConfig;
  onAnswer: (value: string) => void;
}) {
  // Starts empty even when coming back to an answered step: the highlight only marks the tap.
  const [selected, setSelected] = useState<string>();
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const choose = (value: string) => {
    if (timer.current) return; // already advancing
    setSelected(value);
    timer.current = window.setTimeout(() => onAnswer(value), ADVANCE_DELAY_MS);
  };

  return (
    <motion.div className="space-y-7" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>
      <StepHeader title={step.title} subtitle={step.subtitle} />

      {/* One column on mobile, a 2-column grid of taller cards on desktop. */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-4" role="radiogroup" aria-label={step.title}>
        {step.options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <motion.button
              key={option.value}
              variants={appear}
              whileTap={{ scale: 0.985 }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => choose(option.value)}
              className={cn(
                optionCardClass(isSelected),
                "flex w-full items-center gap-4 py-3 pl-3 pr-5 text-left md:flex-col md:items-start md:gap-6 md:p-6",
              )}
              data-testid={`onboarding-option-${step.id}-${option.value}`}
            >
              <SelectionWash selected={isSelected} />
              {option.icon && (
                <motion.span
                  aria-hidden
                  className={cn(
                    "relative flex h-10 w-10 shrink-0 items-center justify-center transition-colors duration-200 md:h-auto md:w-auto",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                  animate={isSelected ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                >
                  <option.icon className="h-6 w-6 md:h-8 md:w-8" strokeWidth={1.75} />
                </motion.span>
              )}
              <span className="relative text-base font-semibold md:text-lg">{option.label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/** End of the onboarding: the paywall once signed in, otherwise the way to create the account first. */
function EndStep({ isSignedIn, onReset }: { isSignedIn: boolean; onReset: () => void }) {
  if (isSignedIn) return <Paywall title="Débloquez vos analyses" />;

  return (
    <motion.div className="space-y-7" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>
      <div className="space-y-2">
        <h1 className={STEP_TITLE_CLASS}>
          <TypewriterText text="Ton profil est prêt !" />
        </h1>
        <motion.p variants={appear} className="text-base text-muted-foreground">
          Crée ton compte pour choisir ton offre et lancer tes premières analyses.
        </motion.p>
      </div>
      <motion.div variants={appear} className="flex flex-col gap-3 md:w-[320px]">
        <Button asChild className="h-12 rounded-[12px] text-base">
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
  const { user, hasPaidPlan, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { progress, answer, next, back, reset } = useOnboardingProgress(ONBOARDING_STEPS.length);

  // Members with a paid plan have nothing to do here.
  if (!isLoading && hasPaidPlan) {
    return <Redirect to="/app" />;
  }

  const total = ONBOARDING_STEPS.length;
  const stepIndex = progress.stepIndex;
  const step = ONBOARDING_STEPS[stepIndex];
  const isDone = stepIndex >= total;

  return (
    <div className="bg-grain relative flex min-h-[100svh] flex-col bg-background">
      {/* Mobile: back + progress, brand mark. Desktop: logo, back + full-width progress, sign-in link. */}
      <header className="relative z-10 grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 pb-2 pt-5 sm:px-6 md:grid-cols-[auto_1fr_auto] md:gap-8 md:px-8 md:pt-7">
        <Link href="/" aria-label="Accueil" className="hidden w-fit transition-opacity hover:opacity-80 md:inline-flex">
          <Logo className="h-7" />
        </Link>
        <div className="flex items-center gap-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={back}
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
        <Logo variant="mark" className="h-7 w-7 md:hidden" />
        {!user && (
          <Link
            href="/login"
            className="hidden justify-self-end text-sm text-muted-foreground transition-colors hover:text-foreground md:inline"
          >
            Déjà un compte ? <span className="font-semibold text-primary">Se connecter</span>
          </Link>
        )}
      </header>

      {/* Desktop: wider column, still starting at the top. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 pb-10 pt-8 sm:px-6 sm:pt-12 md:max-w-[680px] md:pt-16">
        <AnimatePresence mode="wait">
          <motion.div key={isDone ? "done" : step.id} className="flex flex-1 flex-col" {...stepMotion}>
            {isDone ? (
              <EndStep isSignedIn={!!user} onReset={reset} />
            ) : step.type === "social-proof" ? (
              <SocialProofStep onContinue={next} />
            ) : step.type === "betting-insight" ? (
              <BettingInsightStep frequency={singleAnswer(progress.answers["betting-frequency"])} onContinue={next} />
            ) : step.type === "profile-setup" ? (
              <ProfileSetupStep
                onContinue={() => {
                  next();
                  // An account is needed to subscribe: visitors sign up (or sign in) on the auth page.
                  if (!user) setLocation(AUTH_CONFIG.REGISTER_PATH);
                }}
              />
            ) : step.type === "goal-projection" ? (
              <GoalProjectionStep goal={Number(singleAnswer(progress.answers["winnings-goal"])) || undefined} onContinue={next} />
            ) : step.type === "slider" ? (
              <SliderStep
                step={step}
                initial={Number(singleAnswer(progress.answers[step.id])) || undefined}
                onAnswer={(value) => answer(step.id, value)}
              />
            ) : step.type === "multi-choice" ? (
              <MultiChoiceStep
                step={step}
                initial={multiAnswer(progress.answers[step.id])}
                onAnswer={(values) => answer(step.id, values)}
              />
            ) : (
              <SingleChoiceStep step={step} onAnswer={(value) => answer(step.id, value)} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {!user && (
        <footer className="relative z-10 pb-6 text-center text-sm text-muted-foreground md:hidden">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-primary transition-opacity hover:opacity-80">
            Se connecter
          </Link>
        </footer>
      )}
    </div>
  );
}
