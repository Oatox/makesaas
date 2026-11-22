import { motion } from "framer-motion";
import { LEGAL } from "@/config/legal";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { brakeMirror, euros, goalOf } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

const ALONE = "M20 168 C 45 150, 60 142, 78 152 S 104 170, 126 146 S 150 122, 168 150 S 196 176, 214 140 S 238 118, 252 158 S 280 182, 300 176";
const WITH_PLAN = "M20 168 C 60 160, 90 150, 120 136 S 170 108, 200 92 S 260 52, 300 30";
// Where the "alone" curve drops: each one is a give-up.
const GIVE_UPS = [
  { x: 84, y: 153 },
  { x: 170, y: 151 },
  { x: 254, y: 160 },
];
const RED = "hsl(var(--destructive))";

/** "Avec un plan, ça va beaucoup plus vite": the steady climb with a plan, against the ups and downs alone. */
export function CurveStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Avec un plan, ça va beaucoup plus vite.
      </motion.h1>

      <motion.div variants={stepAppear} className="card-3d mt-6 p-4">
        <svg viewBox="0 0 320 200" className="w-full" aria-hidden>
          <defs>
            <linearGradient id="curve-plan" x1="0" x2="1">
              <stop offset="0" stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="hsl(var(--success))" />
            </linearGradient>
          </defs>
          {[50, 100, 150].map((y) => (
            <line key={y} x1="10" x2="310" y1={y} y2={y} stroke="hsl(0 0% 100% / 0.05)" />
          ))}
          <motion.path
            d={ALONE}
            fill="none"
            stroke={RED}
            strokeWidth="2.6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 2.6, ease: "linear" }}
          />
          <motion.path
            d={WITH_PLAN}
            fill="none"
            stroke="url(#curve-plan)"
            strokeWidth="3.4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 2.2, ease: EASE_OUT }}
          />
          {GIVE_UPS.map((point, i) => (
            <motion.text
              key={point.x}
              x={point.x}
              y={point.y + 4}
              textAnchor="middle"
              fill={RED}
              fontSize="13"
              fontWeight="700"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + 0.85 * i, type: "spring", stiffness: 400, damping: 15 }}
              style={{ transformOrigin: `${point.x}px ${point.y}px` }}
            >
              ✕
            </motion.text>
          ))}
          <motion.circle
            cx="300"
            cy="30"
            r="5"
            fill="hsl(var(--success))"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.6, type: "spring", stiffness: 400, damping: 14 }}
            style={{ transformOrigin: "300px 30px" }}
          />
          <circle cx="20" cy="168" r="5" fill="hsl(var(--foreground))" />
          <text x="20" y="192" fill="hsl(var(--muted-foreground))" fontSize="10">
            Aujourd'hui
          </text>
        </svg>

        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-success" />
            Avec {LEGAL.siteName}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-destructive" />
            Seul
          </span>
          <span className="flex items-center gap-1.5">
            <b className="text-destructive">✕</b>
            Abandon
          </span>
        </div>
      </motion.div>

      <motion.p
        className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3, duration: 0.5 }}
      >
        Tu peux continuer à avancer seul. Mais tu nous l'as dit : {brakeMirror(answers)}. Sans plan, bonne chance pour atteindre{" "}
        {euros.format(goalOf(answers))} par mois.
      </motion.p>

      <ContinueButton onClick={onContinue} variants={stepAppear} />
    </motion.div>
  );
}
