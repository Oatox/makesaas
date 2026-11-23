import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion, type Transition } from "framer-motion";
import { Bell, CalendarDays, Check, CreditCard, Lightbulb, Loader2 } from "lucide-react";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { EASE_OUT } from "@/lib/motion";

/*
 * Small animated scenes for the landing steps (Features.tsx): each one plays its step like a real
 * screen recording, on a loop while it is on screen. With reduced motion they show their last
 * frame, still. ⚠️ PLACEHOLDER: the idea, the site and the figures are examples.
 */

type Still = { still: boolean };

/**
 * Frame of a scene. Plays a take (the scene, mounted under a new key) once it is well into view;
 * each take lasts `period` seconds (the scene's own length plus a short beat on its last frame)
 * and only fades out in its last FADE seconds. The next take starts when one ends, as long as
 * part of the scene is still on screen; otherwise the scene waits, faded out, and plays a new
 * take as soon as it is back in view. Chaining the takes on their end (not on a timer) keeps
 * the scene from staying blank after a scroll away or a background tab.
 */
// Fade between two takes, in seconds.
const FADE = 0.3;

function Scene({ period, children }: { period: number; children: (still: boolean) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Well into view: starts a take. Any part on screen: keeps the takes coming.
  const inView = useInView(ref, { amount: 0.4 });
  const onScreen = useInView(ref);
  const onScreenRef = useRef(onScreen);
  onScreenRef.current = onScreen;
  const still = !!useReducedMotion();
  const [take, setTake] = useState(0);
  // A take on, or the last one over and faded out (none before the scene is first seen).
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (inView && !playing) {
      setTake((t) => t + 1);
      setPlaying(true);
    }
  }, [inView, playing]);

  const ended = () => {
    if (onScreenRef.current) setTake((t) => t + 1);
    else setPlaying(false);
  };

  return (
    <div
      ref={ref}
      aria-hidden
      className="relative h-[208px] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.01] p-3.5"
    >
      {/* Warm light from the top, like the hero. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,hsl(var(--primary)/0.12),transparent_65%)]" />
      {(take > 0 || still) && (
        <motion.div
          key={take}
          className="relative h-full"
          animate={still ? undefined : { opacity: [1, 1, 0] }}
          transition={{ duration: period, times: [0, 1 - FADE / period, 1], ease: "linear" }}
          onAnimationComplete={ended}
        >
          {children(still)}
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

type Pose = { opacity?: number; x?: number; y?: number; scale?: number };
type Entrance = { initial: false | Pose; animate?: Pose; transition?: Transition };

/** Entrance from `from` after `delay` seconds (shown at once when still). */
function enter(still: boolean, delay: number, from: Pose = { opacity: 0, y: 6 }): Entrance {
  if (still) return { initial: false };
  const to: Pose = {};
  if (from.opacity !== undefined) to.opacity = 1;
  if (from.x !== undefined) to.x = 0;
  if (from.y !== undefined) to.y = 0;
  if (from.scale !== undefined) to.scale = 1;
  return { initial: from, animate: to, transition: { delay, duration: 0.4, ease: EASE_OUT } };
}

/** Plays `steps` timed calls (seconds), cleared on unmount; nothing when still. */
function useTimeline(still: boolean, steps: [number, () => void][]) {
  useEffect(() => {
    if (still) return;
    const timers = steps.map(([at, run]) => window.setTimeout(run, at * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // The scene remounts for each take: the timeline only needs to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);
}

/** Text appearing piece by piece (words, or letters), from `delay` over `duration` seconds. */
function Reveal({ text, delay, duration, still, by = "word" }: { text: string; delay: number; duration: number; still: boolean; by?: "word" | "letter" }) {
  const pieces = by === "word" ? text.split(" ") : Array.from(text);
  const [shown, setShown] = useState(still ? pieces.length : 0);
  useTimeline(
    still,
    pieces.map((_, i) => [delay + (i * duration) / pieces.length, () => setShown(i + 1)]),
  );
  return <>{pieces.slice(0, shown).join(by === "word" ? " " : "")}</>;
}

/** A number counting up from 0 after `delay` seconds. */
function CountUp({ to, delay, still }: { to: number; delay: number; still: boolean }) {
  const [value, setValue] = useState(still ? to : 0);
  useEffect(() => {
    if (still) return;
    const controls = animate(0, to, { delay, duration: 1.6, ease: EASE_OUT, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [to, delay, still]);
  return <>{value}</>;
}

/** Mouse pointer gliding in onto the middle of its parent at `moveAt`, clicking at `clickAt`. */
function Pointer({ moveAt, clickAt, still }: { moveAt: number; clickAt: number; still: boolean }) {
  if (still) return null;
  return (
    <motion.svg
      viewBox="0 0 20 22"
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[18px] w-[16px] drop-shadow-[0_2px_3px_rgb(0_0_0/0.6)]"
      initial={{ opacity: 0, x: 44, y: 36 }}
      animate={{ opacity: [0, 1, 1, 1, 0], x: [44, 44, 0, 0, 0], y: [36, 36, 0, 0, 0], scale: [1, 1, 1, 0.8, 1] }}
      transition={{
        duration: clickAt - moveAt + 0.6,
        delay: moveAt,
        times: [0, 0.1, 0.55, (clickAt - moveAt) / (clickAt - moveAt + 0.6), 1],
        ease: "easeInOut",
      }}
    >
      <path d="M3 2v15l4.2-3.9 2.9 6.3 2.6-1.2-2.9-6.2 5.8-.3z" fill="white" stroke="black" strokeWidth="1.2" strokeLinejoin="round" />
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Trouve ta niche: a real conversation with Gus                    */
/* ------------------------------------------------------------------ */

const ANSWER = "Vise les coachs perso : ils perdent des heures à gérer leurs réservations.";

function NicheScene({ still }: Still) {
  const [picked, setPicked] = useState(still);
  useTimeline(still, [[4.7, () => setPicked(true)]]);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* The member's answers, sent as a message. */}
      <motion.p
        {...enter(still, 0.2, { opacity: 0, y: 8, scale: 0.96 })}
        className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
      >
        J'adore le sport, j'ai 5 h par semaine.
      </motion.p>

      {/* Gus types, then answers word by word. */}
      <motion.div {...enter(still, 0.8)} className="flex items-start gap-2">
        <CoachAvatar className="mt-0.5 h-6 w-6" />
        <div className="min-w-0">
          <p className="mb-0.5 text-[10px] font-semibold text-primary">{COACH_NAME}</p>
          <p className="relative min-h-[26px] min-w-[46px] rounded-2xl rounded-tl-md border border-white/[0.08] bg-background/70 px-3 py-1.5 text-[12px] leading-snug text-foreground/90">
            <Reveal text={ANSWER} delay={1.9} duration={1.3} still={still} />
            {!still && (
              <motion.span
                className="absolute left-3 top-1/2 flex -translate-y-1/2 gap-1"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ delay: 1.85, duration: 0.1 }}
              >
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
                  />
                ))}
              </motion.span>
            )}
          </p>
        </div>
      </motion.div>

      {/* The idea, as a card to pick: the pointer comes and clicks "Je prends". */}
      <motion.div
        {...enter(still, 3.4, { opacity: 0, y: 10 })}
        className="mt-auto flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.07] p-2.5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold">CoachBook</p>
          <p className="truncate text-[10px] text-muted-foreground">Réservations pour coachs · 19 €/mois</p>
        </div>
        <span className="relative shrink-0">
          <motion.span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200 ${
              picked ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
            }`}
            animate={picked && !still ? { scale: [0.9, 1.06, 1] } : undefined}
            transition={{ duration: 0.35 }}
          >
            {picked ? (
              <>
                Choisie <Check className="h-3 w-3" strokeWidth={3} />
              </>
            ) : (
              "Je prends"
            )}
          </motion.span>
          <Pointer moveAt={3.9} clickAt={4.6} still={still} />
        </span>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Crée ton site: the page builds itself, then goes live            */
/* ------------------------------------------------------------------ */

const LIVE_AT = 4.3;
const SITE_FEATURES = [
  { Icon: CalendarDays, label: "Agenda" },
  { Icon: Bell, label: "Rappels" },
  { Icon: CreditCard, label: "Paiement" },
];

function SiteScene({ still }: Still) {
  const [live, setLive] = useState(still);
  useTimeline(still, [[LIVE_AT, () => setLive(true)]]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-background/80">
      {/* Browser bar: the address types itself, the status turns live. */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-2.5 py-1.5">
        <span className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="h-1.5 w-1.5 rounded-full bg-white/20" />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground">
          <Reveal text="coachbook.fr" delay={0.2} duration={0.7} still={still} by="letter" />
        </span>
        {live ? (
          <motion.span
            initial={still ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            En ligne
          </motion.span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Génération
          </span>
        )}
      </div>

      {/* Build progress along the top of the page. */}
      <div className="h-0.5 bg-white/[0.04]">
        <motion.div
          className="h-full origin-left bg-primary"
          initial={still ? false : { scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: live ? 0 : 1 }}
          transition={{ scaleX: { delay: 0.3, duration: LIVE_AT - 0.4, ease: "easeInOut" }, opacity: { duration: 0.3 } }}
        />
      </div>

      {/* The page itself, block by block. */}
      <div className="flex flex-1 flex-col px-3 pb-2.5 pt-2">
        <motion.div {...enter(still, 1.0)} className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-tight">
            Coach<span className="text-primary">Book</span>
          </span>
          <span className="flex gap-2 text-[9px] text-muted-foreground">
            <span>Tarifs</span>
            <span>Connexion</span>
          </span>
        </motion.div>
        <p className="mt-2.5 min-h-[17px] font-display text-[13px] font-light leading-tight">
          <Reveal text="Réserve ton coach en 2 clics" delay={1.3} duration={0.9} still={still} />
        </p>
        <motion.p {...enter(still, 2.3)} className="mt-1 text-[10px] text-muted-foreground">
          Agenda, rappels et paiement, au même endroit.
        </motion.p>
        <motion.span
          {...enter(still, 2.7, { opacity: 0, scale: 0.85 })}
          className="mt-2 w-fit rounded-full bg-primary px-2.5 py-1 text-[9px] font-semibold text-primary-foreground"
        >
          Essayer gratuitement
        </motion.span>
        <div className="mt-auto grid grid-cols-3 gap-1.5">
          {SITE_FEATURES.map(({ Icon, label }, i) => (
            <motion.span
              key={label}
              {...enter(still, 3.1 + i * 0.2)}
              className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-1.5 py-1.5 text-[9px] text-foreground/80"
            >
              <Icon className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{label}</span>
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Suis ta progression: the figures climb, then a sale comes in     */
/* ------------------------------------------------------------------ */

const SALE_AT = 3.9;
// A smooth rising curve over a 100 × 40 box, ending at the top right (where the sale lands).
const CURVE = "M0,33 C7,31 9,30 14,30 S24,32 28,31 S37,25 42,24 S52,26 56,25 S65,19 70,17 S79,13 84,12 S95,7 100,5";

function ProgressScene({ still }: Still) {
  const [sold, setSold] = useState(still);
  useTimeline(still, [[SALE_AT, () => setSold(true)]]);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-1.5">
        <motion.div {...enter(still, 0.15)} className="rounded-lg border border-white/[0.08] bg-background/70 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground">Visites</p>
          <p className="font-display text-[17px] leading-tight">
            <CountUp to={412} delay={0.4} still={still} />
          </p>
        </motion.div>
        <motion.div {...enter(still, 0.27)} className="rounded-lg border border-white/[0.08] bg-background/70 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground">Inscrits</p>
          <p className="font-display text-[17px] leading-tight">
            <CountUp to={23} delay={0.4} still={still} />
          </p>
        </motion.div>
        {/* Sales: 2, then the new one lands with the notification. */}
        <motion.div
          {...enter(still, 0.39)}
          className={`rounded-lg border px-2 py-1.5 transition-colors duration-500 ${
            sold ? "border-success/40 bg-success/[0.08]" : "border-white/[0.08] bg-background/70"
          }`}
        >
          <p className="text-[9px] text-muted-foreground">Ventes</p>
          <motion.p
            key={sold ? "sold" : "before"}
            className="w-fit font-display text-[17px] leading-tight text-success"
            initial={sold && !still ? { scale: 1.35 } : false}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            {sold ? 3 : <CountUp to={2} delay={0.4} still={still} />}
          </motion.p>
        </motion.div>
      </div>

      {/* The curve over a faint grid, drawn from left to right, its area fading in under it. */}
      <div className="relative mt-2.5 flex-1">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="step-scene-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[10, 20, 30].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="hsl(var(--white) / 0.06)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <motion.path
            d={`${CURVE} L100,40 L0,40 Z`}
            fill="url(#step-scene-area)"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.8 }}
          />
        </svg>
        {/* The line in its own layer, uncovered from left to right: drawing it with pathLength
            would leave gaps, its dashes being measured before the box is stretched. */}
        <motion.svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          initial={still ? false : { clipPath: "inset(-10% 100% -10% 0%)" }}
          animate={{ clipPath: "inset(-10% 0% -10% 0%)" }}
          transition={{ delay: 0.5, duration: 1.8, ease: "easeInOut" }}
        >
          <path
            d={CURVE}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </motion.svg>
        {/* Last point (an HTML dot: the stretched SVG would squash a circle), lit by the sale. */}
        <motion.span
          {...enter(still, 2.3, { opacity: 0, scale: 0.4 })}
          className="absolute right-0 top-[12.5%] h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary ring-2 ring-background"
        />
        {sold && !still && (
          <motion.span
            className="absolute right-0 top-[12.5%] h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-success"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}

        {/* The sale, as a notification. */}
        {(sold || still) && (
          <motion.div
            initial={still ? false : { opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="absolute left-0 top-1 flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-background/90 px-2 py-1 text-[10px] shadow-lg"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Nouvelle vente <span className="font-semibold text-success">+29 €</span>
          </motion.div>
        )}
      </div>
      <p className="mt-1 text-right text-[9px] text-muted-foreground/70">Exemple de chiffres</p>
    </div>
  );
}

export function NicheMotion() {
  // Picked at 4.7s, the pointer gone at 5.2s.
  return <Scene period={6}>{(still) => <NicheScene still={still} />}</Scene>;
}

export function SiteMotion() {
  // Live at 4.3s.
  return <Scene period={5.3}>{(still) => <SiteScene still={still} />}</Scene>;
}

export function ProgressMotion() {
  // The sale at 3.9s, its ripple gone at 4.9s.
  return <Scene period={5.6}>{(still) => <ProgressScene still={still} />}</Scene>;
}
