import { motion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { SelectionWash } from "./OptionCard";
import type { AnswerInput } from "./steps";

/** The answer can be confirmed: no field, an optional one, or a field with some text. */
export const detailReady = (input: AnswerInput | undefined, detail: string) => !input || !!input.optional || detail.trim().length > 0;

/** What a picked card loses when its panel hangs under it: they read as one block. */
export const ATTACHED_CARD_CLASS = "rounded-b-none border-b-0 shadow-none";

/**
 * Panel hanging under the picked card, as its continuation: the reply to that answer. Same orange
 * border as the picked card, no top border and no gap, so card and panel read as one block.
 * Unfolds from the card. (A field asking for more grows out of "Continuer" instead.)
 */
export function AnswerPanel({ note }: { note: string }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className={cn(
        "relative overflow-hidden rounded-b-2xl border border-t-0 border-primary/80 bg-primary/[0.07]",
        "bg-gradient-to-b from-background/40 to-background/40 shadow-[0_6px_16px_-12px_hsl(var(--primary)/0.35)]",
      )}
    >
      <SelectionWash selected />
      {/* Hairline between the answer and its reply, inset like a fold. */}
      <span aria-hidden className="absolute inset-x-4 top-0 h-px bg-primary/20" />

      <div className="relative px-4 pb-4 pt-3 md:px-6 md:pb-5">
        {/* Keyed: another reply in the same place fades in instead of just swapping. */}
        <motion.p
          key={note}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="text-[15px] leading-relaxed text-foreground/90"
        >
          {note}
        </motion.p>
      </div>
    </motion.div>
  );
}
