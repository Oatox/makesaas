import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ChevronRight, Lock } from "lucide-react";
import { LEGAL } from "@/config/legal";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { earnsToday, euros, methodLine, potential } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { TypewriterText } from "./TypewriterText";

// Once the title is typed (seconds): the potential counts up, the arrow carries it to the method's
// slot, a lock shows there, then the dashed rest of the way and today's revenue, then the
// reassurance.
const COUNT_DELAY = 0.15;
const COUNT_DURATION = 1.1;
const LINE_DELAY = 0.5;
const LINE_DURATION = 0.6;
const MISSING_DELAY = LINE_DELAY + LINE_DURATION;
const REST_DELAY = MISSING_DELAY + 0.55;
const TODAY_DELAY = REST_DELAY + 0.3;
const NOTE_DELAY = TODAY_DELAY + 0.5;

// The three steps: a circle with its figure, and a label hanging under it (out of the flow, so
// the arrows between the circles get all the room left).
const NODE =
  "relative flex aspect-square w-[76px] shrink-0 items-center justify-center rounded-full md:w-28 [@media(max-height:720px)]:w-[68px]";
const NODE_FIGURE =
  "font-display text-[30px] font-light leading-none tracking-[-0.04em] tabular-nums md:text-[40px] [@media(max-height:720px)]:text-[26px]";
const NODE_LABEL =
  "absolute left-1/2 top-full mt-3 w-24 -translate-x-1/2 text-balance text-center text-sm leading-snug md:mt-4 md:w-36 md:text-base";

/**
 * "Il te manque la méthode", read from left to right: the potential just shown, then the method
 * (a locked slot: it is what is missing), then what the visitor earns online today.
 */
export function MethodStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const score = potential(answers);
  const earns = earnsToday(answers);
  const reduceMotion = useReducedMotion();
  // The title types out first; the hint and the diagram wait for it.
  const [typed, setTyped] = useState(false);

  const share = useMotionValue(reduceMotion ? score : 0);
  const shown = useTransform(share, (s) => Math.round(s));

  useEffect(() => {
    if (reduceMotion || !typed) return;
    const controls = animate(share, score, { delay: COUNT_DELAY, duration: COUNT_DURATION, ease: EASE_OUT });
    return () => controls.stop();
  }, [typed, score, share, reduceMotion]);

  // Plays once the title is typed (right away when motion is reduced).
  const after = (delay: number, from: Record<string, number | string>, to: Record<string, number | string>, duration = 0.5) => ({
    initial: reduceMotion ? false : from,
    animate: typed ? to : undefined,
    transition: { delay, duration, ease: EASE_OUT },
  });

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <div className="space-y-2 text-center">
        <h1 className={cn(STEP_TITLE_CLASS, "text-balance [@media(max-height:720px)]:text-[24px]")}>
          <TypewriterText text="Mais pour l'instant, il te manque la méthode." onDone={() => setTyped(true)} />
        </h1>
        {/* Own animate: it waits for the typing instead of following the step's stagger. */}
        <motion.p
          variants={stepAppear}
          initial="hidden"
          animate={typed ? "visible" : "hidden"}
          className="text-base text-muted-foreground md:text-lg"
        >
          {methodLine(answers)}
        </motion.p>
      </div>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center py-8 [@media(max-height:720px)]:py-5">
        <div
          role="img"
          aria-label={`Ton potentiel de ${score} sur 100, puis la méthode, qui te manque, puis tes revenus : ${earns === null ? "pas encore assez" : euros.format(earns)}.`}
          className="flex items-center pb-16 md:pb-20"
        >
          {/* 1. The potential. */}
          <motion.div
            variants={stepAppear}
            className={cn(NODE, "border-2 border-primary bg-primary/10 shadow-[0_0_48px_-12px_hsl(var(--primary)/0.7)]")}
          >
            <motion.span className={NODE_FIGURE}>{shown}</motion.span>
            <span className={cn(NODE_LABEL, "text-muted-foreground")}>Ton potentiel</span>
          </motion.div>

          {/* It flows, in orange, into the method; a spark runs along and dies in the empty slot. */}
          <div className="relative mx-1 flex min-w-0 flex-1 items-center">
            <motion.span
              className="h-[2px] flex-1 origin-left rounded-full bg-gradient-to-r from-primary/40 to-primary"
              {...after(LINE_DELAY, { scaleX: 0 }, { scaleX: 1 }, LINE_DURATION)}
            />
            <motion.span
              className="-ml-2.5 flex shrink-0"
              {...after(LINE_DELAY + LINE_DURATION - 0.15, { opacity: 0 }, { opacity: 1 }, 0.2)}
            >
              <ChevronRight className="h-4 w-4 text-primary" strokeWidth={3} />
            </motion.span>
            {!reduceMotion && (
              <motion.span
                className="absolute top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                initial={{ left: "0%", opacity: 0 }}
                animate={typed ? { left: ["0%", "100%"], opacity: [0, 1, 1, 0] } : undefined}
                transition={{ delay: REST_DELAY, duration: 1.2, ease: "easeIn", repeat: Infinity, repeatDelay: 0.7 }}
              />
            )}
          </div>

          {/* 2. The method: a locked slot, its dashed ring turning slowly. */}
          <motion.div variants={stepAppear} className={cn(NODE, "bg-primary/[0.04]")}>
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-dashed border-primary/60"
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 16, ease: "linear", repeat: Infinity }}
            />
            {/* Locked: pops in, then shakes (nothing gets through). */}
            <motion.span
              className="flex text-primary"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
              animate={typed ? { opacity: 1, scale: 1, ...(reduceMotion ? {} : { rotate: [0, -14, 12, -8, 0] }) } : undefined}
              transition={{
                opacity: { delay: MISSING_DELAY, duration: 0.2 },
                scale: { delay: MISSING_DELAY, type: "spring", stiffness: 420, damping: 16 },
                rotate: { delay: MISSING_DELAY + 0.3, duration: 0.5, ease: "easeInOut" },
              }}
            >
              <Lock className="h-7 w-7 md:h-9 md:w-9 [@media(max-height:720px)]:h-6 [@media(max-height:720px)]:w-6" strokeWidth={2} />
            </motion.span>
            <span className={NODE_LABEL}>
              <span className="block font-medium text-foreground">La méthode</span>
              <motion.span
                className="block text-xs font-semibold uppercase tracking-wider text-primary"
                {...after(MISSING_DELAY + 0.15, { opacity: 0 }, { opacity: 1 }, 0.4)}
              >
                manquante
              </motion.span>
            </span>
          </motion.div>

          {/* Nothing gets through: the rest of the way, dashed and dim. */}
          <motion.div className="mx-1 flex min-w-0 flex-1 items-center" {...after(REST_DELAY, { opacity: 0 }, { opacity: 1 }, 0.4)}>
            <span className="h-0 flex-1 border-t-2 border-dashed border-muted-foreground/35" />
            <ChevronRight className="-ml-2.5 h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={3} />
          </motion.div>

          {/* 3. Today's revenue. */}
          <motion.div variants={stepAppear} className={cn(NODE, "border-2 border-destructive/40 bg-destructive/[0.06]")}>
            <motion.span
              className={cn(
                "text-destructive",
                earns === null
                  ? "px-2 text-center text-xs font-semibold leading-tight md:text-sm"
                  : "font-display text-[24px] font-light leading-none tracking-[-0.03em] md:text-[34px] [@media(max-height:720px)]:text-[21px]",
              )}
              {...after(TODAY_DELAY, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1 }, 0.4)}
            >
              {earns === null ? "Pas encore assez" : euros.format(earns)}
            </motion.span>
            <span className={cn(NODE_LABEL, "text-muted-foreground")}>Tes revenus aujourd'hui</span>
          </motion.div>
        </div>

        <motion.p
          className="mt-6 text-balance text-center text-[15px] text-muted-foreground md:text-base [@media(max-height:720px)]:mt-3"
          {...after(NOTE_DELAY, { opacity: 0, y: 8 }, { opacity: 1, y: 0 })}
        >
          Pas d'inquiétude : <span className="font-medium text-foreground">{LEGAL.siteName} s'occupe de la méthode à ta place.</span>
        </motion.p>
      </div>

      <ContinueButton onClick={onContinue} variants={stepAppear} />
    </motion.div>
  );
}
