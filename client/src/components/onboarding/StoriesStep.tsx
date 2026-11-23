import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { MARKET_STORY, SUCCESS_STORIES, type SuccessStory } from "@/config/onboarding-proof";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

const STORIES = [...SUCCESS_STORIES, MARKET_STORY];

/** How long each story stays before the next one comes on its own. */
const AUTOPLAY_SECONDS = 2;

const slidesOf = (track: HTMLElement) => Array.from(track.querySelectorAll<HTMLElement>("[data-slide]"));

function StorySlide({ story, market }: { story: SuccessStory; market: boolean }) {
  return (
    <article data-slide className="card-3d flex w-full shrink-0 snap-center flex-col p-5">
      <div className="flex items-start gap-3">
        {story.logo ? (
          // On a white tile, like an app icon: some logos are a shape on a transparent background.
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/10">
            <img src={story.logo} alt="" width={44} height={44} className="h-full w-full object-cover" />
          </span>
        ) : (
          <span
            aria-hidden
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold",
              market ? "bg-primary/15 text-primary" : "bg-secondary text-foreground",
            )}
          >
            {market ? <Rocket className="h-5 w-5" /> : story.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{story.name}</p>
          <p className="text-xs text-muted-foreground">{story.who}</p>
        </div>
      </div>
      <p className="mt-5 text-xs uppercase tracking-[0.12em] text-muted-foreground">{story.label}</p>
      <p className="font-display text-[40px] leading-tight tracking-[-0.03em] text-primary">
        {story.amount}
        {story.unit && <span className="ml-1.5 text-base text-muted-foreground">{story.unit}</span>}
      </p>
      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-foreground/90">{story.text}</p>
      <small className="mt-4 text-xs text-muted-foreground">Source : {story.source}</small>
    </article>
  );
}

/**
 * "Ils ont tous commencé à zéro": real journeys, then the market, as a swipeable carousel that
 * moves on by itself every AUTOPLAY_SECONDS (the active dot fills meanwhile), back to the first
 * story after the last. It holds while the member hovers it, touches it or tabs into it, starts
 * over after a manual change, and stays still for those who reduce motion.
 */
export function StoriesStep({ onContinue }: { onContinue: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const [held, setHeld] = useState({ hover: false, touch: false, focus: false });
  const isHeld = held.hover || held.touch || held.focus;
  const hold = (key: keyof typeof held, value: boolean) => setHeld((previous) => ({ ...previous, [key]: value }));
  // The active dot's fill: its animation is the autoplay's clock.
  const progress = useRef<HTMLSpanElement>(null);
  const playback = useRef<AnimationPlaybackControls | null>(null);

  // The slide closest to the middle of the track is the current one.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const middle = el.scrollLeft + el.clientWidth / 2;
      const distances = slidesOf(el).map((slide) => Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle));
      setIndex(distances.indexOf(Math.min(...distances)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Scrolls so the slide sits in the middle.
  const go = (target: number) => {
    const el = track.current;
    const slide = el && slidesOf(el)[target];
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft + slide.offsetWidth / 2 - el.clientWidth / 2, behavior: "smooth" });
  };

  // Each new current story fills its dot, then hands over to the next one. A manual change sets a
  // new index, which starts the count again.
  useEffect(() => {
    const fill = progress.current;
    if (!fill || reduceMotion) return;
    let cancelled = false;
    const controls = animate(fill, { scaleX: [0, 1] }, { duration: AUTOPLAY_SECONDS, ease: "linear" });
    playback.current = controls;
    void controls.then(() => {
      if (!cancelled) go((index + 1) % STORIES.length);
    });
    return () => {
      cancelled = true;
      controls.stop();
    };
    // `go` only reads the track's ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reduceMotion]);

  useEffect(() => {
    if (isHeld) playback.current?.pause();
    else playback.current?.play();
  }, [isHeld, index]);

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Ils ont tous commencé à zéro.
      </motion.h1>

      <motion.div
        variants={stepAppear}
        className="mt-6"
        onPointerEnter={(event) => event.pointerType === "mouse" && hold("hover", true)}
        onPointerLeave={(event) => event.pointerType === "mouse" && hold("hover", false)}
        onPointerDown={(event) => event.pointerType !== "mouse" && hold("touch", true)}
        onPointerUp={(event) => event.pointerType !== "mouse" && hold("touch", false)}
        onPointerCancel={() => hold("touch", false)}
        onFocus={(event) => event.target.matches(":focus-visible") && hold("focus", true)}
        onBlur={() => hold("focus", false)}
      >
        {/* One slide at a time, the page's full width: always centered, nothing cut on one side only. */}
        <div ref={track} className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STORIES.map((story, i) => (
            <StorySlide key={story.name} story={story} market={i === STORIES.length - 1} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Histoire précédente"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {STORIES.map((story, i) =>
              i === index ? (
                // The current story: a track that fills up until the next one.
                <span key={story.name} className="relative h-1.5 w-5 overflow-hidden rounded-full bg-primary/30 transition-all duration-300">
                  <span
                    ref={progress}
                    className="absolute inset-0 origin-left rounded-full bg-primary"
                    style={{ transform: reduceMotion ? "scaleX(1)" : "scaleX(0)" }}
                  />
                </span>
              ) : (
                <span key={story.name} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 transition-all duration-300" />
              ),
            )}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === STORIES.length - 1}
            aria-label="Histoire suivante"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      <ContinueButton onClick={onContinue} variants={stepAppear} />
    </motion.div>
  );
}
