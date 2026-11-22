import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { euros, firstName, projection } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

/** 950 → "950 €", 6 300 → "6,3 k€", 13 000 → "13 k€". */
function short(value: number, unit = true) {
  if (value < 1000) return unit ? euros.format(value) : String(value);
  const thousands = value / 1000;
  const text = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: thousands < 10 ? 1 : 0 }).format(thousands);
  return unit ? `${text} k€` : text;
}

const range = (low: number, high: number) => (high < 1000 ? `${euros.format(low)} – ${euros.format(high)}` : `${short(low, false)}–${short(high, false)} k€`);

/** Row that unfolds its explanation. */
function Unfold({ open, onToggle, head, children }: { open: boolean; onToggle: () => void; head: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 py-3 text-left text-sm">
        {head}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pb-3 text-sm leading-relaxed text-muted-foreground"
          >
            {children}
          </motion.p>
        )}
      </AnimatePresence>
    </li>
  );
}

/** "Voici ce que tu pourrais générer chaque mois": an indicative monthly range, split by revenue source. */
export function ProjectionStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const { goal, low, high, sources, resale } = projection(answers);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen(open === key ? null : key);

  const scaleMax = 1000 * Math.ceil((1.3 * Math.max(high, goal)) / 1000);
  const at = (value: number) => `${Math.min(100, (value / scaleMax) * 100)}%`;
  const highTotal = sources.reduce((sum, s) => sum + s.high, 0);

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Voici ce que tu pourrais générer chaque mois.
      </motion.h1>

      <motion.section variants={stepAppear} className="card-3d mt-6 p-5">
        <p className="text-sm text-muted-foreground">Estimation pour {firstName(answers)}</p>
        <p className="mt-1 font-display text-[34px] leading-tight tracking-[-0.02em] md:text-[40px]">
          {short(low)} <span className="text-muted-foreground">–</span> {short(high)}
          <small className="ml-2 font-sans text-base text-muted-foreground">par mois</small>
        </p>

        {/* Scale from 0: the estimated band, and the goal on it. */}
        <div aria-hidden className="relative mt-8 h-2 rounded-full bg-secondary">
          <motion.i
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-primary/70 to-success"
            style={{ left: at(low) }}
            initial={{ width: 0 }}
            animate={{ width: `calc(${at(high)} - ${at(low)})` }}
            transition={{ delay: 0.8, duration: 0.8 }}
          />
          <span className="absolute -top-2 h-6 w-0.5 bg-foreground" style={{ left: at(goal) }}>
            <em className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs not-italic text-muted-foreground">
              Ton objectif · {short(goal)}
            </em>
          </span>
        </div>
        <div aria-hidden className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>{short(scaleMax)}</span>
        </div>

        {/* Split of the estimate between the revenue sources. */}
        <div aria-hidden className="mt-5 flex h-2 gap-1 overflow-hidden rounded-full">
          {sources.map((source, i) => (
            <motion.i
              key={source.label}
              style={{ flexGrow: source.high / highTotal, background: source.color }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 1.2 + 0.12 * i, duration: 0.4 }}
              className="origin-left"
            />
          ))}
        </div>

        <ul className="mt-2 divide-y divide-border">
          {sources.map((source) => (
            <Unfold
              key={source.label}
              open={open === source.label}
              onToggle={() => toggle(source.label)}
              head={
                <>
                  <i aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: source.color }} />
                  <span className="flex-1">{source.label}</span>
                  <b className="font-semibold">{range(source.low, source.high)}</b>
                </>
              }
            >
              {source.detail}
            </Unfold>
          ))}
        </ul>
      </motion.section>

      <motion.ul variants={stepAppear} className="card-3d mt-3 px-5">
        <Unfold
          open={open === "resale"}
          onToggle={() => toggle("resale")}
          head={
            <>
              <span className="flex-1">Et si tu le revends un jour</span>
              <b className="font-semibold text-primary">en une fois</b>
            </>
          }
        >
          {resale}
        </Unfold>
      </motion.ul>

      <motion.p variants={stepAppear} className="mt-3 text-center text-xs text-muted-foreground">
        Estimation indicative à partir de ton profil et de ton objectif. Tes résultats dépendent de ton travail et de ton marché.
      </motion.p>

      <ContinueButton onClick={onContinue} variants={stepAppear} label="Débloquer mon plan" />
    </motion.div>
  );
}
