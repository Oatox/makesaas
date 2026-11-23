import { buzz } from "./haptics";
import { playCashSound, playMessageSound } from "./sounds";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Wifi } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { ContinueButton } from "./ContinueButton";
import { euros, firstName, goalOf } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { StripeIcon } from "./StripeIcon";

const PAYERS = ["Julie M.", "Thomas R.", "Inès B.", "Lucas M.", "Emma R.", "Hugo D.", "Léa P.", "Nathan G.", "Chloé T.", "Yanis K."];
const PRICE = "20,00 €";
// Payments until the goal is reached, then the coach's message, and nothing after it.
const TO_GOAL = 3;
const LAST_BEAT = TO_GOAL + 1;

const cents = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

/** Text of the n-th payment notification (the second one is a new subscription). */
const paymentText = (n: number) => (n === 1 ? `Nouvel abonnement : ${PAYERS[1]}, ${PRICE}/mois` : `Paiement reçu : ${PRICE} ${/^[aeiouyhéèêâîôû]/i.test(PAYERS[n % PAYERS.length]) ? "d'" : "de "}${PAYERS[n % PAYERS.length]}`);

/** Status bar signal, as on an iPhone: four rising bars, all lit. */
function SignalBars() {
  return (
    <span className="flex h-[9.5px] items-end gap-px">
      {[3.5, 5.5, 7.5, 9.5].map((height) => (
        <span key={height} className="w-[2.5px] rounded-[0.75px] bg-white" style={{ height }} />
      ))}
    </span>
  );
}

/** Status bar battery, as on an iPhone: a rounded outline almost full, the small cap on the right. */
function Battery() {
  return (
    <span className="flex items-center">
      <span className="flex h-[10px] w-[20px] rounded-[3px] border border-white/40 p-px">
        <span className="h-full w-[88%] rounded-[1.5px] bg-white" />
      </span>
      <span className="ml-px h-[3.5px] w-[1.5px] rounded-r-[1px] bg-white/40" />
    </span>
  );
}

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
        // Every payment rings like a sale; the last beat is the coach's message.
        if (beat < TO_GOAL) {
          buzz(12);
          playCashSound();
        } else {
          playMessageSound();
        }
      },
      beat === 0 ? 900 : 1150,
    );
    return () => window.clearTimeout(timer);
  }, [beat]);

  const reached = Math.min(beat, TO_GOAL);
  const amount = goal - (TO_GOAL - reached) * 20;
  const coachIn = beat > TO_GOAL;
  // Payments so far, newest first.
  const payments = Array.from({ length: reached }, (_, i) => i).reverse();

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

      {/* The phone rises out of the page: taller than the space it gets, cut at the bottom and faded
          into the background. */}
      <motion.div
        variants={stepAppear}
        aria-hidden
        className="relative mx-auto mt-6 h-[480px] w-[284px] shrink-0 overflow-hidden px-1 pt-1 [mask-image:linear-gradient(to_bottom,#000_64%,transparent_96%)]"
      >
        {/* Side buttons: action and volume on the left, power on the right. */}
        <span className="absolute left-px top-[100px] h-6 w-[3px] rounded-l-sm bg-[#3b3f3d]" />
        <span className="absolute left-px top-[140px] h-11 w-[3px] rounded-l-sm bg-[#3b3f3d]" />
        <span className="absolute left-px top-[194px] h-11 w-[3px] rounded-l-sm bg-[#3b3f3d]" />
        <span className="absolute right-px top-[160px] h-16 w-[3px] rounded-r-sm bg-[#3b3f3d]" />

        {/* Metal frame, then the black bezel around the screen. */}
        <div className="rounded-[52px] bg-gradient-to-b from-[#6e7370] via-[#2c302e] to-[#1c1f1d] p-[2px] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
          <div className="rounded-[50px] bg-black p-2">
            <div className="relative h-[560px] overflow-hidden rounded-[42px] bg-[radial-gradient(120%_70%_at_50%_0%,hsl(var(--primary)/0.45),transparent_60%),linear-gradient(180deg,#1b1310,#0b0d0c)] px-3 pt-3">
              {/* Status bar: the time and the icons each centered in the space beside the Dynamic Island. */}
              <div className="-mx-1 flex h-[26px] items-center text-[12px] font-semibold text-white">
                <span className="flex flex-1 justify-center">9:41</span>
                <div className="h-[26px] w-[92px] shrink-0 rounded-full bg-black" />
                <span className="flex flex-1 items-center justify-center gap-1">
                  <SignalBars />
                  <Wifi className="h-3 w-3" strokeWidth={3} />
                  <Battery />
                </span>
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
                    <Push key={n} sender="Stripe" icon={<StripeIcon className="h-7 w-7 rounded-[8px] text-[15px]" />}>
                      {paymentText(n)}
                    </Push>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.p variants={stepAppear} className="mt-1 text-center text-xs text-muted-foreground">
        Illustration : ton téléphone le jour où tu atteins ton objectif de {euros.format(goal)} par mois.
      </motion.p>

      <ContinueButton onClick={onContinue} variants={stepAppear} />
    </motion.div>
  );
}
