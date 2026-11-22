import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Continuer" of the screens that do not advance on tap: pinned to the bottom on mobile, under the content on desktop. */
export function ContinueButton({
  onClick,
  variants,
  disabled,
}: {
  onClick: () => void;
  variants?: Variants;
  disabled?: boolean;
}) {
  return (
    <motion.div variants={variants} className="mt-auto pt-8 md:mx-auto md:mt-10 md:w-[320px] md:pt-0">
      <Button className="group h-12 w-full rounded-[12px] text-base" onClick={onClick} disabled={disabled} data-testid="button-onboarding-continue">
        Continuer
        <ArrowRight className="!size-[18px] transition-transform duration-200 group-hover:translate-x-1" />
      </Button>
    </motion.div>
  );
}
