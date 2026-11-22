import { Logo } from "@/components/brand/Logo";
import { LEGAL } from "@/config/legal";
import { cn } from "@/lib/utils";

/** How the coach signs its messages in the onboarding. */
export const COACH_NAME = `Ton coach ${LEGAL.siteName}`;

/** The coach's face: the brand mark on a round tile. */
export function CoachAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10", className)}
    >
      <Logo variant="mark" className="h-[45%] w-[60%]" />
    </span>
  );
}
