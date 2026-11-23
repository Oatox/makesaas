import { useState } from "react";
import { Link } from "wouter";
import { Lightbulb, Plus, Rocket } from "lucide-react";
import { COACH_NAME } from "@/components/brand/Coach";
import { EmptyState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { AUTH_CONFIG } from "@/config/auth";
import { SaasDialog, type SaasDialogState } from "./SaasDialog";

/**
 * For pages whose data belongs to a SaaS, when the member has none yet: Gus's ideas first
 * (/lancement), or creating it right here by its name (it can also be from the sidebar). Title and
 * description say what the page will hold.
 */
export function NoSaasState({ title = "Crée d'abord ton SaaS", description }: { title?: string; description: string }) {
  const [dialog, setDialog] = useState<SaasDialogState>(null);
  // Bumped on every opening so the dialog starts empty (see SaasDialog).
  const [dialogKey, setDialogKey] = useState(0);

  return (
    <>
      <EmptyState
        size="large"
        icon={Rocket}
        title={title}
        description={description}
        action={
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <Button asChild>
              <Link href={AUTH_CONFIG.LAUNCH_PATH}>
                <Lightbulb /> Trouver mon idée avec {COACH_NAME}
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDialogKey((key) => key + 1);
                setDialog({ mode: "create" });
              }}
            >
              <Plus /> J'ai déjà mon idée
            </Button>
          </div>
        }
      />
      <SaasDialog key={dialogKey} state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
