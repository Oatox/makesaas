import { Link, useLocation } from "wouter";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { Button } from "@/components/ui/button";
import { useAskGus } from "@/hooks/use-ask-gus";
import { COACH_PATH } from "@/hooks/use-coach";
import { useSaas } from "@/hooks/use-saas";

/** What Gus does from a page: the button's label and the message that opens the discussion. */
type PageAction = { label: string; prompt: string };

/** The pages where Gus works on what they show; elsewhere, "Discuter avec Gus" opens a blank discussion. */
function pageAction(location: string): PageAction | null {
  if (location === "/dash") {
    return {
      label: `Analyser avec ${COACH_NAME}`,
      prompt:
        "Analyse mes revenus : mon MRR, ce que j'encaisse, mes abonnés et ceux qui partent. Dis-moi ce qui va, ce qui ne va pas, et ce que je dois faire maintenant.",
    };
  }
  if (location === "/acquisition") {
    return {
      label: `Analyser avec ${COACH_NAME}`,
      prompt:
        "Analyse mes statistiques TikTok : mes vidéos, mes vues et mes abonnés. Qu'est-ce qui marche, qu'est-ce qui ne marche pas, et qu'est-ce que je dois poster ensuite ?",
    };
  }
  if (location === "/roadmap") {
    return {
      label: `Faire le point avec ${COACH_NAME}`,
      prompt: "Fais le point sur ma roadmap : les objectifs que j'ai atteints, celui en cours, et ce qui m'en rapprochera le plus vite.",
    };
  }
  return null;
}

const BUTTON_CLASS = "min-h-9 shrink-0 gap-2 py-1 pl-1 pr-1 sm:min-h-9 sm:py-1 sm:pr-4";

/**
 * Gus's button, at the top right of every page (AppLayout header). On a page with figures (Tableau de bord,
 * Acquisition, roadmap), Gus works on them: the button opens a discussion that asks him to
 * ("Analyser avec Gus"…). Elsewhere, "Discuter avec Gus" starts a blank one. Hidden on the
 * discussions themselves (the new one and an open one: the sidebar starts another), on Accueil, on the
 * content pages (carousels) and on the admin pages; only Gus's face on phones.
 */
export function TalkToGusButton() {
  const [location] = useLocation();
  const { currentSaas } = useSaas();
  const askGus = useAskGus();
  // Not in the discussions themselves (already with Gus), nor on Accueil and the content pages (their
  // own actions lead), nor on the admin pages (they are not about the member's SaaS).
  const hidden =
    location === COACH_PATH ||
    location.startsWith(`${COACH_PATH}/`) ||
    location === "/accueil" ||
    location === "/acquisition/contenu" ||
    location.startsWith("/acquisition/contenu/") ||
    location === "/admin" ||
    location.startsWith("/admin/");
  if (hidden) return null;

  const action = currentSaas ? pageAction(location) : null;
  const content = (label: string) => (
    <>
      <CoachAvatar className="!size-7" online />
      <span className="hidden sm:inline">{label}</span>
    </>
  );

  if (action && currentSaas) {
    return (
      <Button
        variant="secondary"
        className={BUTTON_CLASS}
        onClick={() => askGus(currentSaas.id, action.prompt)}
        aria-label={action.label}
        title={action.label}
        data-testid="button-talk-to-gus"
      >
        {content(action.label)}
      </Button>
    );
  }

  const label = `Discuter avec ${COACH_NAME}`;
  return (
    <Button asChild variant="secondary" className={BUTTON_CLASS} data-testid="button-talk-to-gus">
      <Link href={COACH_PATH} aria-label={label} title={label}>
        {content(label)}
      </Link>
    </Button>
  );
}
