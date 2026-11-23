import { motion } from "framer-motion";
import { Handshake, Target } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { euros, firstName, projection } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

/** Where the goal sits against the estimate, said plainly and short (one line). */
function verdict(goal: number, low: number, high: number) {
  const target = euros.format(goal);
  if (goal < low) return `Au-dessus de ton objectif de ${target}`;
  if (goal > high) return `Un premier cap vers ${target}`;
  return `Objectif de ${target} atteignable`;
}

/**
 * "Voici ce que tu pourrais gagner chaque mois": an indicative monthly range with the goal on a
 * single gauge, then what the app is worth one day.
 */
export function ProjectionStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const { goal, low, high, resale } = projection(answers);

  // Gauge from 0 to a bit beyond the range or the goal, whichever is higher.
  const scaleMax = 1000 * Math.ceil((1.25 * Math.max(high, goal)) / 1000);
  const at = (value: number) => Math.min(100, (value / scaleMax) * 100);
  // The goal's label stays inside the card near the ends.
  const goalLabelAlign = at(goal) < 18 ? "left-0" : at(goal) > 82 ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Voici ce que tu pourrais gagner chaque mois.
      </motion.h1>

      <motion.section variants={stepAppear} className="card-3d mt-6 p-5">
        <p className="text-sm text-muted-foreground">Estimation pour {firstName(answers)}</p>
        <p className="mt-1 whitespace-nowrap font-display text-[26px] font-light leading-tight sm:text-[32px]">
          {euros.format(low)} <span className="text-muted-foreground">–</span> {euros.format(high)}
        </p>
        <p className="text-sm text-muted-foreground">par mois</p>

        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[13px] font-medium text-primary">
          <Target className="h-3.5 w-3.5" strokeWidth={2.5} />
          {verdict(goal, low, high)}
        </p>

        {/* One gauge from 0: the estimate in orange, the goal as a mark with its label under it. */}
        <div aria-hidden className="relative mb-6 mt-4">
          <div className="relative h-2.5 rounded-full bg-white/[0.07]">
            <motion.div
              className="absolute inset-y-0 rounded-full bg-primary"
              style={{ left: `${at(low)}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${at(high) - at(low)}%` }}
              transition={{ delay: 0.6, duration: 0.8, ease: EASE_OUT }}
            />
            <span className="absolute -top-1.5 h-[22px] w-[3px] -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${at(goal)}%` }} />
          </div>
          <span className="absolute top-full mt-2 whitespace-nowrap text-xs text-muted-foreground" style={{ left: `${at(goal)}%` }}>
            <span className={`absolute top-0 ${goalLabelAlign}`}>Ton objectif</span>
          </span>
        </div>

      </motion.section>

      <motion.p variants={stepAppear} className="mt-3 text-center text-xs text-muted-foreground">
        Estimation indicative, selon ton travail et ton marché.
      </motion.p>

      <motion.p variants={stepAppear} className="mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
        <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
        <span>
          <b className="font-semibold text-foreground">Et plus tard ?</b> {resale}
        </span>
      </motion.p>

      <ContinueButton onClick={onContinue} variants={stepAppear} label="Débloquer mon plan" />
    </motion.div>
  );
}
