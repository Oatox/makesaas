import { AnimatePresence, motion } from "framer-motion";
import { LoaderProgressBar } from "@/components/LoaderProgressBar";
import { DotSphere } from "@/components/onboarding/DotSphere";
import { useElapsed } from "@/hooks/use-elapsed";
import { EASE_OUT } from "@/lib/motion";

/** A new request usually takes about a minute. */
const TYPICAL_MS = 60_000;

/** What Gus is doing, one line after the other (the last one stays until the ideas are there). */
const LINES = [
  "Je relis tes réponses",
  "Je cherche des apps qui se vendent déjà",
  "Je garde celles qui collent à ton temps",
  "Je classe les meilleures pour toi",
];

/**
 * /lancement while Gus writes ideas, in the style of the onboarding's loading screens: the sphere of
 * dots, a line of what he is doing, and a bar easing towards the usual minute (the page moves on to
 * the ideas as soon as they are there, whatever the bar says).
 */
export function IdeasLoader({ title }: { title: string }) {
  const elapsed = useElapsed(true);
  // Fast at first, then slower and slower: about 80 % at the usual minute, 95 % at most.
  const progress = Math.min(0.95, 1 - Math.exp((-1.6 * elapsed) / TYPICAL_MS));
  const line = Math.min(LINES.length - 1, Math.floor((progress / 0.9) * LINES.length));

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={`${title} : ${LINES[line]}`}
      className="flex flex-1 flex-col items-center justify-center text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      <div className="size-[220px] sm:size-[260px]">
        <DotSphere progress={progress} className="size-full" />
      </div>

      <h1 className="mt-4 font-display text-[26px] font-light tracking-tight md:text-[32px]">{title}</h1>

      {/* The current line scrolls up and is replaced by the next one. */}
      <div className="relative mt-1 h-6 w-full overflow-hidden text-base text-muted-foreground">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={line}
            className="absolute inset-x-0 truncate"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            {LINES[line]}…
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-8 w-full max-w-[420px]">
        <LoaderProgressBar value={progress} done={false} />
      </div>
    </motion.div>
  );
}
