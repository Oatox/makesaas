import { motion } from "framer-motion";
import { Flag } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { RollingNumber } from "./RollingNumber";

// TODO(produit) : chiffres provisoires, à remplacer par des données réelles et prouvables avant la
// mise en ligne (une promesse de gains non démontrée est une pratique commerciale trompeuse, et
// l'ANJ interdit de présenter le pari comme une source de revenus).
const GAIN_MULTIPLIER = 5;
/** Average weeks to reach a monthly goal, by goal ceiling (euros). */
const WEEKS_TO_GOAL: Array<[maxGoal: number, weeks: number]> = [
  [200, 1],
  [500, 2],
  [1000, 3],
  [2000, 4],
  [Infinity, 6],
];

const DEFAULT_GOAL = 500;

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const appear = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const weeksFor = (goal: number) => WEEKS_TO_GOAL.find(([max]) => goal <= max)![1];

/** Projection built on the monthly goal picked on the previous screen. */
export function GoalProjectionStep({ goal, onContinue }: { goal: number | undefined; onContinue: () => void }) {
  const target = goal ?? DEFAULT_GOAL;
  const weeks = weeksFor(target);
  const weeksLabel = `${weeks} semaine${weeks > 1 ? "s" : ""}`;

  return (
    <motion.div
      className="flex flex-1 flex-col md:justify-center md:pb-16"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center md:flex-none">
        {/* No entrance animation on the figure: a filter on a parent of the clipped-gradient digits glitches the text. */}
        <RollingNumber
          value={GAIN_MULTIPLIER}
          prefix="×"
          delay={0.1}
          className="font-display text-[72px] font-semibold tracking-[-0.04em] sm:text-[88px] md:text-[112px]"
          digitClassName="bg-gradient-to-b from-white from-30% to-white/50 bg-clip-text text-transparent"
        />

        <motion.p
          variants={appear}
          className="mt-3 max-w-[380px] text-lg leading-snug text-muted-foreground sm:text-xl md:max-w-[460px]"
        >
          En moyenne, nos membres gagnent jusqu'à {GAIN_MULTIPLIER} fois plus sur leurs paris.
        </motion.p>

        {/* Road to the goal: the bar fills up to the flag. */}
        <motion.div variants={appear} className="mt-10 w-full max-w-[420px] text-left">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Ton objectif</span>
            <span className="font-semibold">{euros.format(target)} par mois</span>
          </div>

          <div className="relative mt-3 flex items-center">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary shadow-[inset_0_2px_4px_rgb(0_0_0/0.6)]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_14px_hsl(var(--primary)/0.6)]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.9, duration: 1.6, ease: EASE_OUT }}
              />
            </div>
            <motion.span
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.6)]"
              initial={{ scale: 0.6, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 2.3, type: "spring", stiffness: 420, damping: 16 }}
            >
              <Flag className="h-4 w-4" strokeWidth={2.5} />
            </motion.span>
          </div>

          <div className="mt-2 flex justify-between pr-10 text-xs text-muted-foreground">
            <span>Aujourd'hui</span>
            <span>Semaine {weeks}</span>
          </div>

          <p className="mt-5 text-center text-base md:text-lg">
            Objectif atteint en <span className="font-semibold text-primary">{weeksLabel}</span> en moyenne.
          </p>
        </motion.div>
      </div>

      <ContinueButton onClick={onContinue} variants={appear} />
    </motion.div>
  );
}
