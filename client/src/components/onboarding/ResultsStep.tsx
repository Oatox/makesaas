import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { LAUNCH_RESULTS } from "@/config/onboarding-proof";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { euros } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

const W = 300;
const H = 112;

/** Counts up to `to` once, after `delay` seconds. */
function CountUp({ to, delay }: { to: number; delay: number }) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? to : 0);

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / 900));
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay, reduceMotion]);

  return <>{euros.format(Math.round(value))}</>;
}

/** "Une vraie app, de vrais chiffres": revenue per day of an app, from its launch to its best day. */
export function ResultsStep({ onContinue }: { onContinue: () => void }) {
  const { daily, launch, best, review } = LAUNCH_RESULTS;
  const max = Math.max(...daily);
  const last = daily.length - 1;
  const y = (value: number) => 16 + (1 - value / max) * 92;
  const line = `M${daily.map((v, i) => `${((i / last) * W).toFixed(1)} ${y(v).toFixed(1)}`).join(" L")}`;

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Une vraie app, de vrais chiffres.
      </motion.h1>

      <motion.section variants={stepAppear} className="card-3d mt-6 p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{LAUNCH_RESULTS.appName} · revenus bruts par jour</span>
          <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-semibold text-success">{LAUNCH_RESULTS.badge}</span>
        </div>

        <p className="mt-3 font-display text-[40px] leading-none tracking-[-0.03em] text-success md:text-[48px]">
          <CountUp to={max} delay={1.2} />
        </p>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-28 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="results-stroke" x1="0" x2="1">
              <stop offset="0" stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="hsl(var(--success))" />
            </linearGradient>
            <linearGradient id="results-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="hsl(var(--success))" stopOpacity="0.3" />
              <stop offset="1" stopColor="hsl(var(--success))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.4, 0.7].map((share) => (
            <line key={share} x1="0" x2={W} y1={H * share} y2={H * share} stroke="hsl(0 0% 100% / 0.06)" />
          ))}
          <motion.path
            d={`${line} L${W} ${H} L0 ${H} Z`}
            fill="url(#results-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.6 }}
          />
          <motion.path
            d={line}
            fill="none"
            stroke="url(#results-stroke)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.6, duration: 1.4, ease: EASE_OUT }}
          />
        </svg>

        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            {launch.day} · {euros.format(daily[0])}
          </span>
          <span>{best.day}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "Paiements par jour", from: launch.payments, to: best.payments },
            { label: "Inscrits par jour", from: launch.signups, to: best.signups },
          ].map((row) => (
            <div key={row.label} className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="mt-1 font-semibold">
                {row.from} <span className="text-primary">→</span> {row.to}
              </dd>
            </div>
          ))}
        </dl>
      </motion.section>

      <motion.figure variants={stepAppear} className="card-3d mt-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <figcaption className="text-sm font-semibold">{review.author}</figcaption>
          <span className="flex gap-0.5 text-primary" role="img" aria-label="5 étoiles sur 5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} aria-hidden className="h-4 w-4 fill-current" strokeWidth={0} />
            ))}
          </span>
        </div>
        <blockquote className="mt-2 text-[15px] leading-relaxed">« {review.quote} »</blockquote>
        <p className="mt-2 text-xs text-muted-foreground">{review.note}</p>
      </motion.figure>

      <ContinueButton onClick={onContinue} variants={stepAppear} />
    </motion.div>
  );
}
