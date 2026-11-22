import { buzz } from "./haptics";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { COACH_NAME, CoachAvatar } from "./Coach";
import { ContinueButton } from "./ContinueButton";
import { euros, firstName, goalOf } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

const PAYERS = ["Julie M.", "Thomas R.", "Inès B.", "Lucas M.", "Emma R.", "Hugo D.", "Léa P.", "Nathan G.", "Chloé T.", "Yanis K."];
const PRICE = "20,00 €";
// Payments before the goal is reached, then a few more after the coach's message.
const TO_GOAL = 3;
const LAST_BEAT = 7;

const cents = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

/** Text of the n-th payment notification (the second one is a new subscription). */
const paymentText = (n: number) => (n === 1 ? `Nouvel abonnement : ${PAYERS[1]}, ${PRICE}/mois` : `Paiement reçu : ${PRICE} ${/^[aeiouyhéèêâîôû]/i.test(PAYERS[n % PAYERS.length]) ? "d'" : "de "}${PAYERS[n % PAYERS.length]}`);

function Push({ children, sender, icon }: { children: React.ReactNode; sender: string; icon: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex items-start gap-2.5 rounded-2xl bg-white/10 p-2.5 text-left backdrop-blur-md"
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="flex justify-between text-[11px] font-semibold text-white">
          {sender}
          <span className="font-normal text-white/50">maintenant</span>
        </p>
        <p className="text-[11px] leading-snug text-white/85">{children}</p>
      </div>
    </motion.div>
  );
}

/**
 * "Ta vie pourrait ressembler à ça": the visitor's phone the day the goal is reached. Payments
 * land one by one, the widget fills up to the goal, then the coach congratulates them.
 */
export function FutureStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const reduceMotion = useReducedMotion();
  const goal = goalOf(answers);
  const [beat, setBeat] = useState(reduceMotion ? TO_GOAL + 1 : 0);

  useEffect(() => {
    if (beat >= LAST_BEAT) return;
    const timer = window.setTimeout(
      () => {
        setBeat(beat + 1);
        if (beat < TO_GOAL) buzz(12);
      },
      beat === 0 ? 900 : beat <= TO_GOAL ? 1150 : 1700,
    );
    return () => window.clearTimeout(timer);
  }, [beat]);

  const reached = Math.min(beat, TO_GOAL);
  const amount = goal - (TO_GOAL - reached) * 20 + 20 * Math.max(0, beat - TO_GOAL - 1);
  const coachIn = beat > TO_GOAL;
  // Payments so far (the beat after the goal is the coach's message), newest first, three at most.
  const payments = Array.from({ length: beat }, (_, i) => i)
    .filter((i) => i !== TO_GOAL)
    .map((i) => (i > TO_GOAL ? i - 1 : i))
    .slice(-3)
    .reverse();

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Voilà à quoi ta vie pourrait ressembler.
      </motion.h1>

      <motion.div variants={stepAppear} aria-hidden className="mx-auto mt-6 w-[264px] rounded-[46px] border border-white/10 bg-[#0d0f0e] p-2 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
        <div className="relative h-[452px] overflow-hidden rounded-[38px] bg-[radial-gradient(120%_70%_at_50%_0%,hsl(var(--primary)/0.45),transparent_60%),linear-gradient(180deg,#1b1310,#0b0d0c)] px-3 pt-3">
          <div className="mx-auto h-6 w-24 rounded-full bg-black" />
          <div className="absolute inset-x-6 top-3.5 flex justify-between text-[11px] font-semibold text-white">
            <span>9:41</span>
            <span className="tracking-tight">●●● ▮</span>
          </div>

          <p className="mt-4 text-center text-sm font-medium text-white/70">lundi</p>
          <p className="text-center font-display text-[64px] leading-none tracking-tight text-white">9:41</p>

          <div className="mt-4 rounded-2xl bg-white/10 p-3 text-left text-white backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/70">Ton app · ce mois</span>
              {reached >= TO_GOAL ? (
                <span className="flex items-center gap-1 font-semibold text-success">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  Objectif atteint
                </span>
              ) : (
                <span className="text-white/70">Objectif {euros.format(goal)}</span>
              )}
            </div>
            <p className="mt-1 text-xl font-semibold">{cents.format(amount)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className={cn("h-full rounded-full", reached >= TO_GOAL ? "bg-success" : "bg-primary")}
                animate={{ width: `${Math.min(100, (amount / goal) * 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {coachIn && (
                <Push key="coach" sender={COACH_NAME} icon={<CoachAvatar className="h-7 w-7" />}>
                  Bravo {firstName(answers)}, objectif atteint. Ta tâche du jour est prête.
                </Push>
              )}
              {payments.map((n) => (
                <Push
                  key={n}
                  sender="Stripe"
                  icon={<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#635bff] text-xs font-bold text-white">S</span>}
                >
                  {paymentText(n)}
                </Push>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <motion.p variants={stepAppear} className="mt-3 text-center text-xs text-muted-foreground">
        Illustration : ton téléphone le jour où tu atteins ton objectif de {euros.format(goal)} par mois.
      </motion.p>

      <ContinueButton onClick={onContinue} variants={stepAppear} />
    </motion.div>
  );
}
