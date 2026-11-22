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
import { RevealItem, RevealSection } from "@/components/landing/SectionReveal";
import { useAuth } from "@/hooks/use-auth";
import { blurIn as blurInVariants } from "@/lib/motion";
import { MEMBER_COUNT_SHORT } from "@/config/social-proof";

function Header() {
  // Not sticky: sits on top of the hero and scrolls away with the page.
  // Always targets /app; signed-out visitors are redirected to the login page.
  const { user } = useAuth();
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="absolute inset-x-0 top-0 z-50 mx-auto flex w-full items-center justify-between px-6 py-5"
    >
      <a href="#hero" className="flex items-center gap-2 transition-opacity hover:opacity-80">
        <Logo className="h-7" />
      </a>

      <Link href="/app">
        <Button size="sm" className="px-4">{user ? "App" : "Démarrer"}</Button>
      </Link>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

// Entrance used by every hero element: fade in from a blur, slightly from below.
const blurIn = blurInVariants({ duration: 0.8 });

const HERO_TITLE = ["Lance ton SaaS", "en quelques jours"];

function LaurelBranch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 44" aria-hidden className={`h-11 w-5 text-foreground/70 ${className}`} fill="currentColor">
      <path d="M15 42C7 34 5 20 9 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="6" cy="34" rx="2.2" ry="4.6" transform="rotate(-50 6 34)" />
      <ellipse cx="4.5" cy="25" rx="2.2" ry="4.6" transform="rotate(-25 4.5 25)" />
      <ellipse cx="5" cy="16" rx="2" ry="4.2" transform="rotate(-10 5 16)" />
      <ellipse cx="8" cy="7.5" rx="1.8" ry="3.8" transform="rotate(10 8 7.5)" />
      <ellipse cx="12.5" cy="29" rx="1.9" ry="4" transform="rotate(40 12.5 29)" />
      <ellipse cx="12" cy="19" rx="1.8" ry="3.8" transform="rotate(30 12 19)" />
    </svg>
  );
}

function SocialProof() {
  return (
    <motion.div variants={blurIn} className="inline-flex items-center gap-2">
      <LaurelBranch />
      <p className="text-sm text-foreground/80">
        {/* Placeholder social proof: replace with your real figure */}
        <span className="font-semibold text-foreground">{MEMBER_COUNT_SHORT}</span> utilisateurs satisfaits
      </p>
      <LaurelBranch className="-scale-x-100" />
    </motion.div>
  );
}

function Hero() {
  return (
    <section id="hero" className="relative isolate flex min-h-[100svh] items-center justify-center px-4 pb-16 pt-24">
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.08 }}
        className="relative mx-auto w-full max-w-5xl"
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
          <SocialProof />

          <h1 className="font-display text-[38px] leading-[1.1] sm:text-5xl md:text-[64px]">
            {/* First line appears word by word */}
            <span className="block text-balance">
              {HERO_TITLE[0].split(" ").map((word, i) => (
                <motion.span key={`${word}-${i}`} variants={blurIn} className="inline-block whitespace-pre">
                  {word}{" "}
                </motion.span>
              ))}
            </span>
            {/* Second line in the brand orange */}
            <motion.span variants={blurIn} className="block text-highlight">
              {HERO_TITLE[1]}
            </motion.span>
          </h1>

          <motion.p variants={blurIn} className="max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
            Auth, onboarding, paiements, admin et IA sont déjà prêts.{" "}
            <span className="font-semibold text-foreground">Construis seulement ton produit.</span>
          </motion.p>

          <motion.div variants={blurIn} className="pt-2">
            <LandingCta />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="bg-grain min-h-screen bg-background relative overflow-hidden">
      <main className="relative mx-auto max-w-6xl">
      <Header />

      <Hero />

      <Features />

      <Testimonials />

      {/* FAQ Section */}
      <RevealSection id="faq" className="py-24 md:py-32 px-4">
        <div className="max-w-3xl mx-auto">
          <RevealItem className="text-center mb-16 space-y-4">
            <h2 className="font-display text-3xl md:text-4xl">Questions fréquentes</h2>
            <p className="text-muted-foreground">Tout ce qu'il faut savoir avant de commencer.</p>
          </RevealItem>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS.map((item, i) => (
              <RevealItem key={i}>
              <AccordionItem value={`item-${i}`} className="border rounded-xl px-6 bg-card shadow-sm">
                <AccordionTrigger className="font-display font-medium text-lg py-6 hover:text-primary transition-colors">
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
