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
  if (location === "/app") {
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
  if (location === "/acquisition/contenu") {
    return {
      label: `Idées avec ${COACH_NAME}`,
      prompt:
        "Propose-moi 5 idées de carrousels TikTok pour mon app, à partir de ce qui marche déjà sur mes comptes : pour chacune, le sujet et l'accroche de la première slide.",
    };
  }
  if (location === "/roadmap") {
    return {
      label: `Faire le point avec ${COACH_NAME}`,
      prompt: "Fais le point sur ma roadmap : où j'en suis, ce qui me bloque peut-être, et ce que je dois faire cette semaine pour avancer.",
    };
  }
  return null;
}

const BUTTON_CLASS = "min-h-9 shrink-0 gap-2 py-1 pl-1 pr-1 sm:min-h-9 sm:py-1 sm:pr-4";

/**
 * Gus's button, at the top right of every page (AppLayout header). On a page with figures (Accueil,
 * Acquisition, content, roadmap), Gus works on them: the button opens a discussion that asks him to
 * ("Analyser avec Gus"…). Elsewhere, "Discuter avec Gus" starts a blank one. Hidden on the
 * new-discussion page itself; only Gus's face on phones.
 */
export function TalkToGusButton() {
  const [location] = useLocation();
  const { currentSaas } = useSaas();
  const askGus = useAskGus();
  if (location === COACH_PATH) return null;

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
