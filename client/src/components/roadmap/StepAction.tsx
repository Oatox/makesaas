import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, ImagePlus, Loader2, MessageCircle, Settings, SquareTerminal } from "lucide-react";
import { APP_URL_MAX_LENGTH, type RoadmapState, type StepAction as Action } from "@shared/roadmap";
import { chatGptUrl, missionPromptText, PROMPT_TARGET } from "@shared/roadmap-prompts";
import type { Saas } from "@shared/saas";
import { SaasAvatar } from "@/components/saas/SaasAvatar";
import { SaasDialog, type SaasDialogState } from "@/components/saas/SaasDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAskGus } from "@/hooks/use-ask-gus";
import { addressAnswers, roadmapKeys, useSetAppUrl } from "@/hooks/use-roadmap";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * A message for Base44 or ChatGPT: where it goes, a short preview (unfolded on demand) and its copy
 * button. `openInChatGpt`: "Ouvrir ChatGPT" opens it with the message already written, and copying
 * it stays possible (ChatGPT signed out, another app).
 */
function PromptCopy({ text, into, openInChatGpt = false }: { text: string; into: string; openInChatGpt?: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Whether the folded preview hides part of the message (measured: the drawer's width changes it).
  const previewRef = useRef<HTMLPreElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview || expanded) return;
    const measure = () => setOverflows(preview.scrollHeight > preview.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [text, expanded]);

  const copy = async () => {
    if (!(await copyText(text))) {
      setExpanded(true);
      toast({ variant: "destructive", title: "Copie impossible", description: "Sélectionne le message à la main pour le copier." });
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <p className="flex items-center gap-2 border-b border-border/60 px-3.5 py-2 text-xs text-muted-foreground">
        <SquareTerminal className="h-3.5 w-3.5" />
        {openInChatGpt ? "Message pour" : "Message à coller dans"} <span className="font-semibold text-foreground">{into}</span>
      </p>
      <div className="relative">
        <pre
          ref={previewRef}
          className={cn(
            "whitespace-pre-wrap break-words px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85",
            !expanded && "max-h-44 overflow-hidden",
          )}
        >
          {text}
        </pre>
        {/* Unfolds over the fade at the bottom of the preview, and folds back from under the message. */}
        {!expanded && overflows && (
          <div className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-background via-background/80 to-transparent pb-1">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} className="text-muted-foreground">
              Voir tout le message <ChevronDown />
            </Button>
          </div>
        )}
        {expanded && (
          <div className="flex justify-center pb-1">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="text-muted-foreground">
              Réduire <ChevronDown className="rotate-180" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 border-t border-border/60 p-2.5 sm:flex-row sm:items-center">
        {openInChatGpt && (
          <Button asChild className="w-full sm:w-auto">
            <a href={chatGptUrl(text)} target="_blank" rel="noreferrer">
              Ouvrir ChatGPT <ExternalLink />
            </a>
          </Button>
        )}
        <Button
          variant={openInChatGpt ? "ghost" : "default"}
          size={openInChatGpt ? "sm" : "default"}
          onClick={() => void copy()}
          className={openInChatGpt ? "text-muted-foreground" : "w-full sm:w-auto"}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copié" : "Copier le message"}
        </Button>
      </div>
    </div>
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
      // Its mission gets done: the drawer celebrates it.
      await setAppUrl.mutateAsync({ saasId, url: address });
    } catch (error) {
      toast({ variant: "destructive", title: "Adresse refusée", description: error instanceof ApiError ? error.message : "Réessaie dans un instant." });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="L'adresse de ton app"
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

/**
 * Opens the SaaS's settings on a tab (its logo, its payment account). Closing them reads the roadmap
 * again, so the mission they complete gets checked at once.
 */
function SettingsAction({ saas, tab, children }: { saas: Saas; tab: "general" | "payments"; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<SaasDialogState>(null);
  const [dialogKey, setDialogKey] = useState(0);
  return (
    <>
      <Button
        className="w-full sm:w-auto"
        onClick={() => {
          setDialogKey((key) => key + 1);
          setDialog({ mode: "edit", saas, tab });
        }}
      >
        {children}
      </Button>
      <SaasDialog
        key={dialogKey}
        state={dialog}
        onClose={() => {
          setDialog(null);
          void queryClient.invalidateQueries({ queryKey: roadmapKeys.state(saas.id) });
        }}
      />
    </>
  );
}

/** The button of a mission's step, right under its text. */
export function StepActionButton({ action, saas, state }: { action: Action; saas: Saas; state: RoadmapState }) {
  const askGus = useAskGus();

  switch (action.kind) {
    case "open":
      return (
        <Button asChild className="w-full sm:w-auto">
          <a href={action.url} target="_blank" rel="noreferrer">
            {action.label} <ExternalLink />
          </a>
        </Button>
      );
    case "page":
      return (
        <Button asChild className="w-full sm:w-auto">
          <Link href={action.href}>
            {action.label} <ArrowRight />
          </Link>
        </Button>
      );
    case "chatgpt":
      return <PromptCopy text={missionPromptText(action.prompt, state.project)} into="ChatGPT" openInChatGpt />;
    case "copy":
      return <PromptCopy text={missionPromptText(action.prompt, state.project)} into={PROMPT_TARGET[action.prompt]} />;
    case "gus":
      return (
        <Button
          className="w-full sm:w-auto"
          onClick={() => askGus(saas.id, action.message)}
        >
          <MessageCircle /> {action.label}
        </Button>
      );
    case "settings":
      return (
        <div className="flex items-center gap-3">
          {action.tab === "general" && saas.logo_url && (
            <SaasAvatar name={saas.name} seed={saas.id} logoUrl={saas.logo_url} className="size-11 rounded-xl" />
          )}
          <SettingsAction saas={saas} tab={action.tab}>
            {action.tab === "general" ? <ImagePlus /> : <Settings />}
            {action.tab === "general" && saas.logo_url ? "Changer mon logo" : action.label}
          </SettingsAction>
        </div>
      );
    case "app_url":
      return <AppUrlForm saasId={saas.id} appUrl={state.appUrl} />;
  }
}
