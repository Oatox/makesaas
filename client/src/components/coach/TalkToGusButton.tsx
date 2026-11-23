import { Link, useLocation } from "wouter";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { Button } from "@/components/ui/button";
import { COACH_PATH } from "@/hooks/use-coach";

/**
 * "Discuter avec Gus", at the top right of every page (AppLayout header): starts a new discussion.
 * Hidden on the new-discussion page itself; only Gus's face on phones.
 */
export function TalkToGusButton() {
  const [location] = useLocation();
  if (location === COACH_PATH) return null;

  const label = `Discuter avec ${COACH_NAME}`;
  return (
    <Button
      asChild
      variant="secondary"
      className="min-h-9 shrink-0 gap-2 py-1 pl-1 pr-1 sm:min-h-9 sm:py-1 sm:pr-4"
      data-testid="button-talk-to-gus"
    >
      <Link href={COACH_PATH} aria-label={label} title={label}>
        <CoachAvatar className="!size-7" online />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    </Button>
  );
}
