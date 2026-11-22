import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { RollingNumber } from "./RollingNumber";

type BettingInsight = {
  /** Big slot-machine figure at the top. */
  stat: { value: number; prefix?: string; suffix?: string };
  headline: string;
  /** Share of bettors drawn in orange on the 20-people chart, and what that group is. */
  crowd?: { share: number; label: string };
};

// Spaces around the figure must not break: plain ones would collapse at the edge of the reels.
const NBSP = String.fromCharCode(160);

// TODO(produit) : les pourcentages sont indicatifs, à confirmer avec une vraie source (ANJ, sondage)
// avant la mise en ligne. Keyed by the values of the "betting-frequency" step.
const INSIGHTS: Record<string, BettingInsight> = {
  daily: {
    stat: { prefix: `Top${NBSP}`, value: 5, suffix: `${NBSP}%` },
    headline: "Tu fais partie des 5 % de parieurs les plus actifs.",
    crowd: { share: 5, label: "Les 5 % les plus actifs" },
  },
  "several-per-week": {
    stat: { prefix: `Top${NBSP}`, value: 15, suffix: `${NBSP}%` },
    headline: "Tu paries plus souvent que 85 % des parieurs.",
    crowd: { share: 15, label: "Les 15 % les plus actifs" },
  },
  weekly: {
    stat: { prefix: `Top${NBSP}`, value: 30, suffix: `${NBSP}%` },
    headline: "Tu paries plus régulièrement que 70 % des parieurs.",
    crowd: { share: 30, label: "Les 30 % les plus réguliers" },
  },
  "few-per-month": {
    stat: { value: 40, suffix: `${NBSP}%` },
    headline: "des parieurs jouent comme toi, quelques fois par mois.",
    crowd: { share: 40, label: "Les parieurs comme toi" },
  },
  never: {
    stat: { value: 0, suffix: `${NBSP}pari` },
    headline: "Tu pars de zéro, donc sans mauvaises habitudes. On t'accompagne dès ton premier pari.",
  },
};

const appear = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const CROWD_SIZE = 20;
const SHARE_PER_PERSON = 100 / CROWD_SIZE;

/**
 * 20 bettors, the group of the visitor in orange (1 person = 5 %). The people appear one by one,
 * then the group lights up. The headline above says it in words, so it never relies on color alone.
 */
function CrowdChart({ share, label }: { share: number; label: string }) {
  const highlighted = Math.max(1, Math.round(share / SHARE_PER_PERSON));

  return (
    <motion.figure variants={appear} className="mt-7 flex justify-center">
      <motion.div
        role="img"
        aria-label={`${label} : ${highlighted} parieurs sur ${CROWD_SIZE}`}
        className="flex max-w-[300px] flex-wrap justify-center gap-x-1.5 gap-y-2 md:max-w-none md:flex-nowrap"
        variants={{ visible: { transition: { staggerChildren: 0.025, delayChildren: 0.2 } } }}
      >
        {Array.from({ length: CROWD_SIZE }, (_, i) => (
          <motion.span
            key={i}
            className="relative block h-6 w-6 md:h-7 md:w-7"
            variants={{
              hidden: { opacity: 0, scale: 0.5 },
              visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 24 } },
            }}
          >
            <UserRound className="h-full w-full fill-current text-muted-foreground/25" strokeWidth={0} />
            {i < highlighted && (
              <motion.span
                className="absolute inset-0 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.55)]"
                initial={{ opacity: 0, scale: 1.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + i * 0.06, duration: 0.35, ease: EASE_OUT }}
              >
                <UserRound className="h-full w-full fill-current" strokeWidth={0} />
              </motion.span>
            )}
          </motion.span>
        ))}
      </motion.div>
    </motion.figure>
  );
}

/** Screen tailored to the betting frequency the visitor just picked. */
export function BettingInsightStep({ frequency, onContinue }: { frequency: string | undefined; onContinue: () => void }) {
  const insight = INSIGHTS[frequency ?? ""] ?? INSIGHTS.never;

  return (
    <motion.div
      className="flex flex-1 flex-col md:justify-center md:pb-16"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.09 } } }}
    >
      {/* Centered above the button on mobile; on desktop the block and its button are centered together. */}
      <div className="flex flex-1 flex-col items-center justify-center text-center md:flex-none">
        {/* No entrance animation on the figure: a filter on a parent of the clipped-gradient digits glitches the text. */}
        <RollingNumber
          {...insight.stat}
          delay={0.1}
          className="font-display text-[64px] font-semibold tracking-[-0.04em] sm:text-[80px] md:text-[104px]"
          digitClassName="bg-gradient-to-b from-white from-30% to-white/50 bg-clip-text text-transparent"
        />

        <motion.p
          variants={appear}
          className="mt-3 max-w-[380px] text-lg leading-snug text-muted-foreground sm:text-xl md:max-w-[460px]"
        >
          {insight.headline}
        </motion.p>

        {insight.crowd && <CrowdChart {...insight.crowd} />}
      </div>

      <ContinueButton onClick={onContinue} variants={appear} />
    </motion.div>
  );
}
