import { AnimatePresence, motion } from "framer-motion";
import { LoaderProgressBar } from "@/components/LoaderProgressBar";
import { useElapsed } from "@/hooks/use-elapsed";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { DotSphere } from "./DotSphere";

/** What the "setup" goes through, one line at a time (paced on the clock: nothing is computed). */
const STEPS = [
  "Analyse de ton niveau en foot",
  "Prise en compte de ta fréquence de paris",
  "Sélection de tes compétitions",
  "Calibrage de ton objectif de gains",
  "Préparation de tes premières analyses",
] as const;
const STEP_MS = 1400;
const TOTAL_MS = STEPS.length * STEP_MS;

const appear = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** "Configuring your profile": a sphere of dots lighting up while the steps scroll by. */
export function ProfileSetupStep({ onContinue }: { onContinue: () => void }) {
  const elapsed = useElapsed(true);
  const done = elapsed >= TOTAL_MS;
  const progress = Math.min(1, elapsed / TOTAL_MS);
  const step = Math.min(Math.floor(elapsed / STEP_MS), STEPS.length - 1);

  return (
    <motion.div
      className="flex flex-1 flex-col md:justify-center md:pb-16"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-label={done ? "Ton profil est prêt" : `Configuration de ton profil : ${STEPS[step]}`}
        className="flex flex-1 flex-col items-center justify-center text-center md:flex-none"
      >
        <motion.div variants={appear} className="size-[240px] sm:size-[280px]">
          <DotSphere progress={progress} className="size-full" />
        </motion.div>

        <motion.div variants={appear} className="mt-4 w-full">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={done ? "done" : "running"}
              className="font-display text-[26px] font-semibold tracking-tight md:text-[32px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {done ? "Ton profil est prêt" : "Configuration de ton profil"}
            </motion.h1>
          </AnimatePresence>

          {/* The current step scrolls up and is replaced by the next one. */}
          <div className="relative mt-1 h-6 overflow-hidden text-base text-muted-foreground">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={done ? "done" : step}
                className="absolute inset-x-0"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                {done ? "Tes analyses sont personnalisées." : `${STEPS[step]}…`}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div variants={appear} className="mt-8 w-full max-w-[420px]">
          <LoaderProgressBar value={progress} done={done} />
        </motion.div>
      </div>

      <ContinueButton onClick={onContinue} variants={appear} disabled={!done} />
    </motion.div>
  );
}
