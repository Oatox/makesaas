import * as React from "react";
import { Link } from "wouter";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingCta } from "@/components/landing/LandingCta";
import { StackMarquee } from "@/components/landing/StackMarquee";
import { RevealItem, RevealSection } from "@/components/landing/SectionReveal";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_CONFIG } from "@/config/auth";
import { blurIn as blurInVariants } from "@/lib/motion";

function Header() {
  // Not sticky: sits on top of the hero and scrolls away with the page.
  // "Commencer" targets /app: signed-out visitors land on the onboarding. Members sign in from here.
  const { user } = useAuth();
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="absolute inset-x-0 top-0 z-50 mx-auto flex w-full items-center justify-between px-6 py-5"
    >
      <a href="#hero" className="flex items-center gap-2 transition-opacity hover:opacity-80">
        <Logo className="h-3.5 sm:h-5" />
      </a>

      <div className="flex items-center gap-1.5">
        {!user && (
          <Link href={AUTH_CONFIG.LOGIN_PATH}>
            <Button size="sm" variant="ghost" className="px-3 text-muted-foreground hover:text-foreground" data-testid="link-landing-login">
              Se connecter
            </Button>
          </Link>
        )}
        <Link href={AUTH_CONFIG.REDIRECT_PATH}>
          <Button size="sm" className="px-4">{user ? "App" : "Commencer"}</Button>
        </Link>
      </div>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

// Entrance used by every hero element: fade in from a blur, slightly from below.
const blurIn = blurInVariants({ duration: 0.8 });

// Value promise: two parallel sentences, the second in a dimmer white. If you change them, update
// the divisors of the h1 size (see the comment on the h1).
const HERO_TITLE = ["Lance ton business.", "Trouve tes premiers clients."];
// The promise, picked out of the second sentence in the brand orange (must appear in HERO_TITLE[1]).
const HERO_HIGHLIGHT = "premiers clients";
// Pill above the title.
const HERO_BADGE = "Avec ou sans idée";

// Light beams sliding along the grid: `line` is a row (from the top) for "x", a column (from the
// center) for "y". Staggered so one or two are in flight at a time.
const GRID_BEAMS: { axis: "x" | "y"; line: number; delay: number; duration: number }[] = [
  { axis: "x", line: 2, delay: 0, duration: 8 },
  { axis: "y", line: -6, delay: 1.5, duration: 7 },
  { axis: "x", line: 7, delay: 3.5, duration: 9 },
  { axis: "y", line: 5, delay: 4.5, duration: 7.5 },
  { axis: "y", line: -2, delay: 6, duration: 9 },
  { axis: "x", line: 11, delay: 7, duration: 8.5 },
];
// Spelled out in full so Tailwind keeps these @layer utilities classes in the build.
const BEAM_CLASS = { x: "hero-beam hero-beam-x", y: "hero-beam hero-beam-y" };

// Full-bleed grid behind the hero. It sits outside <main> (capped at max-w-6xl) so it spans the
// whole viewport; .hero-grid fades it (and the beams) out before the edges.
function HeroBackdrop() {
  return (
    <div aria-hidden className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[100svh] overflow-hidden">
      {GRID_BEAMS.map(({ axis, line, delay, duration }, i) => (
        <span
          key={i}
          className={BEAM_CLASS[axis]}
          style={{ "--line": line, "--beam-delay": `${delay}s`, "--beam-duration": `${duration}s` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function Hero() {
  return (
    // Exactly one screen tall (down to a minimum for very short screens): the text centered between
    // the navbar (76px, in the top padding) and the tools strip pinned at the bottom. The next section
    // starts below the fold.
    <section id="hero" className="relative isolate flex h-[100svh] min-h-[580px] flex-col px-4 pb-8 pt-24 md:pb-10">
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.08 }}
        className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col justify-center"
      >
        <div className="flex w-full flex-col items-center gap-6 text-center [container-type:inline-size]">
          {/* Pill above the title: a glowing green dot, then the reassurance. */}
          <motion.p
            variants={blurIn}
            className="-mb-1 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-sm text-foreground/85 backdrop-blur-sm md:-mb-2"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_1px_hsl(var(--success)/0.7)]" />
            {HERO_BADGE}
          </motion.p>

          {/* The size follows the width of this column (cqw, so the scrollbar never counts), with a
              little margin (widths in Unbounded Light, in times the font size):
              - from sm, one line per sentence: "Trouve tes premiers clients." (14.3) fits;
              - on phones that would be too small, so the second sentence wraps before "premiers
                clients." (kept together, 8.6) and the size is set by "Lance ton business." (10.5). */}
          <h1 className="landing-title font-display text-[length:clamp(16px,calc(100cqw/10.9),44px)] sm:whitespace-nowrap sm:text-[length:clamp(16px,calc(100cqw/14.7),76px)]">
            {/* First line appears word by word */}
            <span className="block text-balance">
              {HERO_TITLE[0].split(" ").map((word, i, words) => (
                <motion.span key={`${word}-${i}`} variants={blurIn} className="inline-block whitespace-pre">
                  {/* No trailing space after the last word: it would count in the line width and wrap it early */}
                  {word}{i < words.length - 1 ? " " : ""}
                </motion.span>
              ))}
            </span>
            {/* Second line in a slightly dimmer white, its promise in orange: lighter at the top,
                with a soft glow around the letters (a filter, so it follows the clipped gradient). */}
            <motion.span variants={blurIn} className="block text-balance text-foreground/70">
              {HERO_TITLE[1].split(HERO_HIGHLIGHT)[0]}
              {/* Never split: on phones the promise gets a line of its own. */}
              <span className="whitespace-nowrap">
                <span className="bg-gradient-to-b from-[hsl(30_100%_72%)] to-primary bg-clip-text text-transparent [filter:drop-shadow(0_0_0.35em_hsl(var(--primary)/0.35))]">
                  {HERO_HIGHLIGHT}
                </span>
                {HERO_TITLE[1].split(HERO_HIGHLIGHT)[1]}
              </span>
            </motion.span>
          </h1>

          {/* What the member gets, its three parts in white so the line reads at a glance. Small on
              phones, so the title leads. */}
          <motion.p variants={blurIn} className="max-w-xl text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-lg md:text-xl lg:max-w-2xl lg:text-[22px]">
            Une <span className="text-foreground">idée faite pour toi</span>, un <span className="text-foreground">plan clair jour après jour</span> et
            un <span className="text-foreground">coach à chaque étape</span>, de ton site à tes premiers clients.
          </motion.p>

          <motion.div variants={blurIn} className="pt-2">
            <LandingCta size="lg" />
          </motion.div>
        </div>
      </motion.div>

      <StackMarquee />
    </section>
  );
}

export default function Landing() {
  return (
    <div className="bg-grain min-h-screen bg-background relative overflow-hidden">
      <HeroBackdrop />
      <main className="relative mx-auto max-w-6xl">
      <Header />

      <Hero />

      <Features />

      <Faq />

      <LandingFooter />
      </main>
    </div>
  );
}
