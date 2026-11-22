import * as React from "react";
import { Link } from "wouter";
import { Logo } from "@/components/brand/Logo";
import { FAQS } from "@/config/faq";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { Features } from "@/components/landing/Features";
import { Testimonials } from "@/components/landing/Testimonials";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingCta } from "@/components/landing/LandingCta";
import { HeroVideo } from "@/components/landing/HeroVideo";
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
        <Link href="/app">
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
// the divisor of the h1 size (see the comment on the h1).
const HERO_TITLE = ["Lance ton business.", "Trouve tes premiers clients."];

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
    // Exactly one screen tall (down to a minimum for very short screens): the text, then the sales
    // video. The next section starts below the fold.
    <section id="hero" className="relative isolate flex h-[100svh] min-h-[620px] flex-col px-4 pt-28 md:pt-32">
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.08 }}
        className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col justify-center md:justify-start"
      >
        <div className="flex w-full flex-col items-center gap-6 text-center [container-type:inline-size]">
          {/* One line per sentence at every width: the size follows the width of this column (cqw, so the
              scrollbar never counts) so the longest line ("Trouve tes premiers clients.", about 14.3 times
              the font size wide in Unbounded Light) fits, with a little margin. */}
          <h1 className="landing-title whitespace-nowrap font-display text-[length:clamp(16px,calc(100cqw/14.7),76px)]">
            {/* First line appears word by word */}
            <span className="block text-balance">
              {HERO_TITLE[0].split(" ").map((word, i, words) => (
                <motion.span key={`${word}-${i}`} variants={blurIn} className="inline-block whitespace-pre">
                  {/* No trailing space after the last word: it would count in the line width and wrap it early */}
                  {word}{i < words.length - 1 ? " " : ""}
                </motion.span>
              ))}
            </span>
            {/* Second line in a slightly dimmer white */}
            <motion.span variants={blurIn} className="block text-balance text-foreground/70">
              {HERO_TITLE[1]}
            </motion.span>
          </h1>

          {/* Smaller on phones, where the one-line-per-sentence title is small too, so the title still leads */}
          <motion.p variants={blurIn} className="max-w-xl text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-lg md:text-xl lg:max-w-2xl lg:text-[22px]">
            Un plan simple. Avec un coach à chaque étape.
          </motion.p>

          <motion.div variants={blurIn} className="pt-2">
            <LandingCta size="lg" />
          </motion.div>
        </div>

        {/* Phones: the video takes the full width, and text and video are centered together in the screen.
            From md: a stage filling the rest of the screen, as a size container (cqw / cqh are its width
            / height); the video is as large as fits: the stage width, 768px, or 86% of the stage height,
            whichever is smallest. */}
        <div className="relative mt-8 min-h-0 md:mt-10 md:flex-1 md:[container-type:size]">
          <motion.div variants={blurIn} className="relative z-10 mx-auto w-full md:w-[min(100cqw,768px,calc(86cqh*16/9))]">
            {/* Warm glow behind the video */}
            <div aria-hidden className="absolute inset-x-[10%] inset-y-[15%] -z-10 rounded-full bg-primary/25 blur-[90px]" />
            <HeroVideo />
          </motion.div>
        </div>
      </motion.div>
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

      <StackMarquee />

      <Features />

      <Testimonials />

      {/* FAQ Section */}
      <RevealSection id="faq" className="py-24 md:py-32 px-4">
        <div className="max-w-3xl mx-auto">
          <RevealItem className="text-center mb-16 space-y-4">
            <h2 className="landing-title font-display text-[32px] md:text-[48px]">Questions fréquentes</h2>
            <p className="text-muted-foreground">Tout ce qu'il faut savoir avant de commencer.</p>
          </RevealItem>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS.map((item, i) => (
              <RevealItem key={i}>
              <AccordionItem value={`item-${i}`} className="border rounded-xl px-6 bg-card shadow-sm">
                <AccordionTrigger className="font-display font-normal text-lg py-6 hover:text-primary transition-colors">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
              </RevealItem>
            ))}
          </Accordion>
        </div>
      </RevealSection>

      <LandingFooter />
      </main>
    </div>
  );
}
