import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ExternalLink, Loader2, MessageCircle, Settings } from "lucide-react";
import { APP_URL_MAX_LENGTH, type MissionTool, type RoadmapState } from "@shared/roadmap";
import { buildAppPrompt, buildPaymentPrompt } from "@shared/roadmap-prompts";
import type { Saas } from "@shared/saas";
import { COACH_NAME } from "@/components/brand/Coach";
import { CoachMarkdown } from "@/components/coach/CoachMarkdown";
import { SaasDialog, type SaasDialogState } from "@/components/saas/SaasDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addressAnswers, useFirstMission, useSetAppUrl } from "@/hooks/use-roadmap";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";

/** A prompt to paste into Claude, with its copy button (Gus's code blocks). */
function Prompt({ text }: { text: string }) {
  return <CoachMarkdown text={`\`\`\`\n${text}\n\`\`\``} className="text-sm" />;
}

/** "Demander à Gus": the discussion of the first mission, where Gus gives the next steps. */
function AskGus({ saasId }: { saasId: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const firstMission = useFirstMission();

  const open = async () => {
    try {
      const { conversationId } = await firstMission.mutateAsync(saasId);
      navigate(`/discussions/${conversationId}`);
    } catch (error) {
      toast({ variant: "destructive", title: "Discussion indisponible", description: error instanceof ApiError ? error.message : "Réessaie dans un instant." });
    }
  };

  return (
    <Button variant="secondary" className="h-10" onClick={() => void open()} disabled={firstMission.isPending}>
      {firstMission.isPending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
      Demander de l'aide à {COACH_NAME}
    </Button>
  );
}

/** The address of the member's app: checked from the browser, then saved (its mission gets done). */
function AppUrlForm({ saasId, appUrl }: { saasId: string; appUrl: string | null }) {
  const { toast } = useToast();
  const setAppUrl = useSetAppUrl();
  const [url, setUrl] = useState(appUrl ?? "");
  const [checking, setChecking] = useState(false);
  const busy = checking || setAppUrl.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = url.trim();
    if (!value || busy) return;
    const address = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    setChecking(true);
    const answers = await addressAnswers(address);
    setChecking(false);
    if (!answers) {
      toast({ variant: "destructive", title: "Ton app ne répond pas", description: "Vérifie l'adresse, et que ton app est bien publiée." });
      return;
    }
    try {
      await setAppUrl.mutateAsync({ saasId, url: address });
      toast({ title: "Ton app est en ligne", description: "Mission accomplie." });
    } catch (error) {
      toast({ variant: "destructive", title: "Adresse refusée", description: error instanceof ApiError ? error.message : "Réessaie dans un instant." });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="app-url" className="text-sm font-medium">
        L'adresse de ton app
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="app-url"
          inputMode="url"
          value={url}
          maxLength={APP_URL_MAX_LENGTH}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://mon-app.netlify.app"
          className="h-11"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={busy || !url.trim()}>
          {busy && <Loader2 className="animate-spin" />}
          Valider
        </Button>
      </div>
      {appUrl && (
        <a href={appUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          Ouvrir mon app <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </form>
  );
}

/** Opens the SaaS's settings on its payment account. */
function PaymentAccount({ saas }: { saas: Saas }) {
  const [dialog, setDialog] = useState<SaasDialogState>(null);
  const [dialogKey, setDialogKey] = useState(0);
  return (
    <>
      <Button
        className="h-10"
        onClick={() => {
          setDialogKey((key) => key + 1);
          setDialog({ mode: "edit", saas, tab: "payments" });
        }}
      >
        <Settings /> Connecter mon compte de paiement
      </Button>
      <SaasDialog key={dialogKey} state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

/** The interactive block of a mission's tutorial. */
export function MissionToolBlock({ tool, saas, state }: { tool: MissionTool; saas: Saas; state: RoadmapState }) {
  switch (tool) {
    case "app_prompt":
      return (
        <div className="space-y-3">
          <Prompt text={buildAppPrompt(state.project)} />
          <AskGus saasId={saas.id} />
        </div>
      );
    case "payment_prompt":
      return <Prompt text={buildPaymentPrompt(state.project)} />;
    case "app_url":
      return <AppUrlForm saasId={saas.id} appUrl={state.appUrl} />;
    case "payment_account":
      return <PaymentAccount saas={saas} />;
  }
}
