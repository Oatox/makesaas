import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Puzzle, Target, UserRound } from "lucide-react";
import type { IdeaContent, SaasIdea } from "@shared/ideas";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { stepAppear } from "@/components/onboarding/StepHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** What "En savoir plus" unfolds, in reading order. */
const DETAILS: { key: keyof IdeaContent; label: string; icon: typeof Target }[] = [
  { key: "problem", label: "Le problème", icon: Target },
  { key: "audience", label: "Pour qui", icon: UserRound },
  { key: "whyYou", label: "Pourquoi toi", icon: Puzzle },
];

/**
 * One idea of /lancement: its name and pitch, the details behind "En savoir plus", and the
 * button that makes it the member's project. The first idea of a series is the one Gus recommends.
 */
export function IdeaCard({
  idea,
  recommended,
  keeping,
  disabled,
  onKeep,
}: {
  idea: SaasIdea;
  recommended: boolean;
  /** This idea is being kept. */
  keeping: boolean;
  disabled: boolean;
  onKeep: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { content } = idea;
  const detailsId = `idea-details-${idea.id}`;

  return (
    <motion.article variants={stepAppear} className={cn("card-3d p-5 sm:p-6", recommended && "border-primary/45")}>
      {recommended && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 py-1 pl-1 pr-3 text-xs font-medium text-primary">
          <CoachAvatar className="h-5 w-5" />
          Celle que {COACH_NAME} te conseille
        </p>
      )}

      <h2 className="break-words font-display text-2xl font-light leading-tight sm:text-[28px]">{content.name}</h2>
      <p className="mt-2 text-base text-muted-foreground">{content.pitch}</p>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="-ml-1 mt-3 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        En savoir plus
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <dl className="mt-3 space-y-4 border-t border-border pt-4">
              {DETAILS.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex gap-3">
                  <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <dt className="text-sm font-medium">{label}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{content[key]}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        className="mt-5 h-11 w-full"
        variant={recommended ? "default" : "secondary"}
        onClick={onKeep}
        disabled={disabled}
        data-testid={`button-keep-idea-${idea.position}`}
      >
        {keeping && <Loader2 className="animate-spin" />}
        Je garde cette idée
      </Button>
    </motion.article>
  );
}
