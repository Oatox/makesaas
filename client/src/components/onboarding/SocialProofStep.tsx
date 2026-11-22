import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TESTIMONIALS } from "@/components/landing/Testimonials";
import { cn } from "@/lib/utils";
import { MEMBER_COUNT, MEMBER_COUNT_SHORT } from "@/config/social-proof";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { RollingNumber } from "./RollingNumber";

const AVATARS = TESTIMONIALS.slice(0, 5);
// Time each review stays on screen.
const QUOTE_INTERVAL_MS = 3500;

const appear = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Landing reviews, one at a time, cross-fading every few seconds. */
function TestimonialRotator() {
  const [index, setIndex] = useState(0);

  // Restarts on every change, so picking a dot gives that review a full interval.
  useEffect(() => {
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % TESTIMONIALS.length), QUOTE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  return (
    <figure className="card-3d px-6 pb-5 pt-6">
      <span aria-hidden className="absolute -top-4 left-5 font-display text-6xl leading-none text-primary">
        “
      </span>

      {/* Every review sits in the same grid cell: the card keeps the height of the longest one. */}
      <div className="grid">
        {TESTIMONIALS.map((t, i) => {
          const active = i === index;
          return (
            <motion.div
              key={t.name}
              aria-hidden={!active}
              className={cn("col-start-1 row-start-1 flex flex-col justify-between", !active && "pointer-events-none")}
              initial={false}
              animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <blockquote className="text-[17px] font-medium leading-relaxed text-foreground">{t.quote}</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <img src={t.avatar} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 rounded-full object-cover" />
                <span className="text-sm leading-tight">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="text-muted-foreground">{t.role}</span>
                </span>
              </figcaption>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-center gap-1.5">
        {TESTIMONIALS.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Avis ${i + 1} sur ${TESTIMONIALS.length}`}
            aria-current={i === index}
            className="flex h-4 items-center"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
              )}
            />
          </button>
        ))}
      </div>
    </figure>
  );
}

export function SocialProofStep({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div
      className="flex flex-1 flex-col md:flex-none"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.09 } } }}
    >
      <div className="flex flex-col items-center text-center">
        {/* No entrance animation here: a filter on a parent of the clipped-gradient digits glitches the text. */}
        <div className="relative">
          <RollingNumber
            value={MEMBER_COUNT}
            prefix="+"
            delay={0.1}
            className="relative font-display text-[72px] font-semibold tracking-[-0.04em] sm:text-[88px] md:text-[112px]"
            digitClassName="bg-gradient-to-b from-white from-30% to-white/50 bg-clip-text text-transparent"
          />
        </div>

        <motion.p variants={appear} className="mt-3 max-w-[380px] text-lg leading-snug text-muted-foreground sm:text-xl md:max-w-[460px]">
          parieurs analysent leurs matchs avec MakeSaaS et ne parient plus jamais à l'aveugle.
        </motion.p>

        <motion.div
          variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
          className="mt-6 flex items-center"
        >
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

      <motion.div variants={appear} className="mt-9 md:mx-auto md:w-full md:max-w-[560px]">
        <TestimonialRotator />
      </motion.div>

      <ContinueButton onClick={onContinue} variants={appear} />
    </motion.div>
  );
}
