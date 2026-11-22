import { motion } from "framer-motion";
import { TESTIMONIALS } from "@/components/landing/Testimonials";
import { LEGAL } from "@/config/legal";
import { MEMBER_COUNT, MEMBER_COUNT_SHORT } from "@/config/social-proof";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { RollingNumber } from "./RollingNumber";

const AVATARS = TESTIMONIALS.slice(0, 5);

const appear = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Who the members are, said for the visitor's situation (answer to "profil"). */
const PEERS: Record<string, string> = {
  etudiant: "dont beaucoup d'étudiants comme toi",
  salarie: "dont beaucoup de salariés comme toi",
  freelance: "dont beaucoup d'indépendants comme toi",
};

/**
 * "+31 847 personnes…": the member count, said for the visitor's situation, with the members'
 * faces. Centered on the screen, shown right after "frustrations".
 */
export function SocialProofStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const peers = PEERS[typeof answers.profil === "string" ? answers.profil : ""];

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.09 } } }}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* No entrance animation here: a filter on a parent of the clipped-gradient digits glitches the text. */}
        <RollingNumber
          value={MEMBER_COUNT}
          prefix="+"
          delay={0.1}
          className="relative font-display text-[72px] font-light tracking-[-0.04em] sm:text-[88px] md:text-[112px]"
          digitClassName="bg-gradient-to-b from-white from-30% to-white/50 bg-clip-text text-transparent"
        />

        <motion.p variants={appear} className="mt-3 max-w-[400px] text-lg leading-snug text-muted-foreground sm:text-xl md:max-w-[480px]">
          personnes lancent leur projet avec {LEGAL.siteName}
          {peers ? `, ${peers}.` : ", chacune depuis sa propre situation."}
        </motion.p>

        <motion.div variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }} className="mt-6 flex items-center">
          {AVATARS.map((t, i) => (
            <motion.img
              key={t.name}
              variants={{
                hidden: { opacity: 0, scale: 0.6, x: -6 },
                visible: { opacity: 1, scale: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 22 } },
              }}
              src={t.avatar}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-[3px] ring-background"
              style={{ marginLeft: i === 0 ? 0 : -10, zIndex: AVATARS.length - i }}
            />
          ))}
          <motion.span
            variants={appear}
            className="-ml-2.5 flex h-10 items-center rounded-full bg-secondary pl-4 pr-3 text-xs font-semibold text-foreground ring-[3px] ring-background"
          >
            {MEMBER_COUNT_SHORT}
          </motion.span>
        </motion.div>
      </div>

      <ContinueButton onClick={onContinue} variants={appear} />
    </motion.div>
  );
}
