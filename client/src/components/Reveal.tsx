import { Children, isValidElement, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { blurIn } from "@/lib/motion";

const revealContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const revealItem = blurIn({ y: 28, blur: 8, scale: 0.98, transition: { type: "spring", stiffness: 180, damping: 22, mass: 0.9 } });

/**
 * Page blocks come in one after the other, rising out of a blur.
 * A child whose key changes later (e.g. a tab's content) replays the entrance on its own.
 */
export function Reveal({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className="flex flex-col gap-6">{children}</div>;

  return (
    <motion.div className="flex flex-col gap-6" variants={revealContainer} initial="hidden" animate="visible">
      {Children.toArray(children).map((child, index) => (
        // A child can be a fragment of several blocks (e.g. the AI groups): keep the page spacing between them.
        <motion.div
          key={isValidElement(child) && child.key !== null ? child.key : index}
          className="flex flex-col gap-6"
          variants={revealItem}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
