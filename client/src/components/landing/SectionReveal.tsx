import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion";
import { blurIn } from "@/lib/motion";

/** One block of a landing section: rises out of a blur, like the hero. */
export const revealItem: Variants = blurIn({ y: 32, blur: 8 });

/** Container whose children come in one after the other (e.g. a row of crests). */
export const revealStagger = (stagger = 0.06): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
});

/**
 * Landing section that reveals its `RevealItem` children in sequence the first time it scrolls into view.
 * With reduced motion everything is shown right away.
 */
export function RevealSection({ children, ...props }: HTMLMotionProps<"section">) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ staggerChildren: 0.12 }}
      {...props}
    >
      {children}
    </motion.section>
  );
}

export function RevealItem(props: HTMLMotionProps<"div">) {
  return <motion.div variants={revealItem} {...props} />;
}
