import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Check,
  Flame,
  Footprints,
  GraduationCap,
  HandCoins,
  Hammer,
  Heart,
  Mountain,
  RotateCcw,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { firstName, situationTags, strengths, weaknesses, type StrengthKind } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { TypewriterText } from "./TypewriterText";

const STRENGTH_ICON: Record<StrengthKind, LucideIcon> = {
  drive: Flame,
  passion: Heart,
  speed: Zap,
  solid: Mountain,
  started: Hammer,
  dared: RotateCcw,
  customers: HandCoins,
  early: GraduationCap,
  income: Wallet,
  seller: Briefcase,
  "first-step": Footprints,
};

// When the first weakness gets its fix, then the gap between two (seconds).
const FIRST_FIX = 2.2;
const NEXT_FIX = 0.7;

const pop = {
  hidden: { opacity: 0, x: -12, scale: 0.97 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", stiffness: 340, damping: 26 } },
};

// The screen fills exactly the viewport height: the lists keep their size and the ID card takes the
// room left. Tall screens (≥ 940 px) get bigger text, short ones (≤ 720 px) a tighter layout.
const CARD = "card-3d px-3.5 pb-1 pt-3 [@media(max-height:720px)]:pt-2 [@media(min-height:940px)]:px-5 [@media(min-height:940px)]:pt-4";
const ROW = "flex items-center gap-3 py-2 [@media(max-height:720px)]:py-1.5 [@media(min-height:940px)]:gap-4 [@media(min-height:940px)]:py-2.5";
const ICON_SLOT = "flex h-8 w-5 shrink-0 items-center justify-center [@media(min-height:940px)]:w-6";
const ICON = "h-5 w-5 [@media(min-height:940px)]:h-6 [@media(min-height:940px)]:w-6";
const TITLE = "text-sm font-semibold leading-snug [@media(min-height:940px)]:text-base";
const LABEL = "font-sans text-xs font-medium tracking-normal text-muted-foreground [@media(min-height:940px)]:text-sm";

// The ID card takes the room the lists leave. It is a line by default, a column when the screen is
// tall enough (phones from 850 px, computers from 960 px: their header is taller) and a big column
// above (920 px / 1020 px). Thresholds measured so the screen never scrolls.
// Column from these heights (both sizes); "roomy" and "big" sizes in exclusive ranges so they never compete.
const HERO_LAYOUT =
  "flex-row gap-3.5 p-2 text-left [@media(max-height:720px)]:p-1 " +
  "max-md:[@media(min-height:850px)]:flex-col max-md:[@media(min-height:850px)]:p-5 max-md:[@media(min-height:850px)]:text-center " +
  "md:[@media(min-height:960px)]:flex-col md:[@media(min-height:960px)]:p-5 md:[@media(min-height:960px)]:text-center " +
  "max-md:[@media(min-height:850px)_and_(max-height:919px)]:gap-3 md:[@media(min-height:960px)_and_(max-height:1019px)]:gap-3 " +
  "max-md:[@media(min-height:920px)]:gap-4 md:[@media(min-height:1020px)]:gap-4";
const HERO_TEXT =
  "max-md:[@media(min-height:850px)]:flex max-md:[@media(min-height:850px)]:flex-col max-md:[@media(min-height:850px)]:items-center " +
  "md:[@media(min-height:960px)]:flex md:[@media(min-height:960px)]:flex-col md:[@media(min-height:960px)]:items-center";
const HERO_TAGS = "max-md:[@media(min-height:850px)]:justify-center md:[@media(min-height:960px)]:justify-center";
const AVATAR_SIZE =
  "h-12 w-12 text-xl [@media(max-height:720px)]:h-10 [@media(max-height:720px)]:w-10 " +
  "max-md:[@media(min-height:850px)_and_(max-height:919px)]:h-16 max-md:[@media(min-height:850px)_and_(max-height:919px)]:w-16 max-md:[@media(min-height:850px)_and_(max-height:919px)]:text-2xl " +
  "md:[@media(min-height:960px)_and_(max-height:1019px)]:h-16 md:[@media(min-height:960px)_and_(max-height:1019px)]:w-16 md:[@media(min-height:960px)_and_(max-height:1019px)]:text-2xl " +
  "max-md:[@media(min-height:920px)]:h-24 max-md:[@media(min-height:920px)]:w-24 max-md:[@media(min-height:920px)]:text-4xl " +
  "md:[@media(min-height:1020px)]:h-24 md:[@media(min-height:1020px)]:w-24 md:[@media(min-height:1020px)]:text-4xl";
const NAME_SIZE =
  "text-xl max-md:[@media(min-height:850px)_and_(max-height:919px)]:text-2xl md:[@media(min-height:960px)_and_(max-height:1019px)]:text-2xl " +
  "max-md:[@media(min-height:920px)]:text-4xl md:[@media(min-height:1020px)]:text-4xl";
const TAG_SIZE =
  "px-2.5 py-1 text-sm max-md:[@media(min-height:850px)_and_(max-height:919px)]:px-3 md:[@media(min-height:960px)_and_(max-height:1019px)]:px-3 " +
  "max-md:[@media(min-height:920px)]:px-3.5 max-md:[@media(min-height:920px)]:py-1.5 max-md:[@media(min-height:920px)]:text-base " +
  "md:[@media(min-height:1020px)]:px-3.5 md:[@media(min-height:1020px)]:py-1.5 md:[@media(min-height:1020px)]:text-base";

/** Initial in a ring of the brand orange, slowly turning. */
function Avatar({ name }: { name: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <span aria-hidden className={cn("relative shrink-0", AVATAR_SIZE)}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.55), hsl(var(--primary)))" }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <span className="absolute inset-[3px] flex items-center justify-center rounded-full bg-card font-display">{name.charAt(0).toLocaleUpperCase("fr-FR")}</span>
    </span>
  );
}

/** How many weaknesses have received their fix so far: one after the other, after the strengths. */
function useFixesShown(count: number) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? count : 0);

  useEffect(() => {
    if (reduceMotion || shown >= count) return;
    const timer = window.setTimeout(() => setShown(shown + 1), (shown === 0 ? FIRST_FIX : NEXT_FIX) * 1000);
    return () => window.clearTimeout(timer);
  }, [shown, count, reduceMotion]);

  return shown;
}

/**
 * "Ton profil d'entrepreneur", filling exactly the screen: an ID card (initial in a turning ring,
 * first name, age and situation) as big as the room left, the strengths popping in one by one,
 * then each weakness turning into a tick as the plan's fix lands.
 */
export function FounderProfileStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const name = firstName(answers);
  const good = strengths(answers);
  const bad = weaknesses(answers);
  const fixed = useFixesShown(bad.length);

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.12 } } }}>
      <h1 className={cn(STEP_TITLE_CLASS, "[@media(max-height:720px)]:text-[24px] md:[@media(max-height:820px)]:text-[32px]")}>
        <TypewriterText text="Ton profil d'entrepreneur" />
      </h1>

      <div className="mt-4 flex flex-1 flex-col gap-3 [@media(max-height:720px)]:mt-3 [@media(max-height:720px)]:gap-2 [@media(min-height:721px)_and_(max-height:820px)]:mt-3 [@media(min-height:721px)_and_(max-height:820px)]:gap-2.5">
        {/* ID card: takes the room the lists leave, laid out for the screen height (see HERO_LAYOUT). */}
        <motion.section variants={stepAppear} className={cn("relative flex flex-1 items-center justify-center", HERO_LAYOUT)}>
          <Avatar name={name} />
          <div className={cn("relative min-w-0", HERO_TEXT)}>
            <p className={cn("truncate font-display font-light leading-tight", NAME_SIZE)}>{name}</p>
            {/* Age and situation, as tags: the first name is already above. */}
            <div className={cn("mt-1.5 flex flex-wrap gap-1.5", HERO_TAGS)}>
              {situationTags(answers).map((tag) => (
                <span key={tag.kind} className={cn("rounded-full border border-primary/30 bg-primary/10 font-semibold text-primary", TAG_SIZE)}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section variants={stepAppear} className={CARD}>
          <h2 className={LABEL}>Tes points forts</h2>
          <motion.ul className="mt-1 divide-y divide-border" variants={{ visible: { transition: { staggerChildren: 0.14, delayChildren: 0.5 } } }}>
            {good.map((s) => {
              const Icon = STRENGTH_ICON[s.kind];
              return (
                <motion.li key={s.title} variants={pop} className={ROW}>
                  <span aria-hidden className={cn(ICON_SLOT, "text-success")}>
                    <Icon className={ICON} strokeWidth={2} />
                  </span>
                  <p className={cn(TITLE, "min-w-0")}>{s.title}</p>
                </motion.li>
              );
            })}
          </motion.ul>
        </motion.section>

        <motion.section variants={stepAppear} className={CARD}>
          <h2 className={LABEL}>Tes points faibles</h2>
          <motion.ul className="mt-1 divide-y divide-border" variants={{ visible: { transition: { staggerChildren: 0.14, delayChildren: 1.1 } } }}>
            {bad.map((w, i) => {
              const isFixed = i < fixed;
              return (
                <motion.li key={w.title} variants={pop} className={ROW}>
                  {/* The red mark turns into a green tick once the fix lands. */}
                  <motion.span
                    aria-hidden
                    className={cn(ICON_SLOT, "text-lg font-bold transition-colors duration-300", isFixed ? "text-success" : "text-destructive")}
                    animate={isFixed ? { scale: [1, 1.3, 1], rotate: [0, -10, 0] } : { scale: 1 }}
                    transition={{ duration: 0.45 }}
                  >
                    {isFixed ? <Check className={ICON} strokeWidth={3} /> : "!"}
                  </motion.span>
                  <div className="min-w-0">
                    <p className={cn(TITLE, "transition-colors duration-300", isFixed && "text-muted-foreground")}>{w.title}</p>
                    {/* Laid out from the start and only faded in: the card never changes height. */}
                    <motion.p
                      aria-hidden={!isFixed}
                      initial={false}
                      animate={isFixed ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                      className="flex items-start gap-1.5 text-xs leading-snug text-foreground/90 [@media(min-height:940px)]:text-sm"
                    >
                      <ArrowRight aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                      <span className="min-w-0 [@media(max-height:720px)]:truncate">{w.fix}</span>
                    </motion.p>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        </motion.section>
      </div>

      <ContinueButton
        onClick={onContinue}
        variants={stepAppear}
        label="Voir mon potentiel"
        className="pt-5 [@media(max-height:720px)]:pt-3 [@media(min-height:721px)_and_(max-height:820px)]:pt-4"
      />
    </motion.div>
  );
}
