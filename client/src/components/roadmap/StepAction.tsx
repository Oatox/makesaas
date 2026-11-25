import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, ImagePlus, Loader2, MessageCircle, RefreshCw, SquareTerminal } from "lucide-react";
import { TIKTOK_FIRST_VIDEO_CHECK_MINUTES } from "@shared/acquisition";
import { APP_URL_MAX_LENGTH, PAYMENT_LINK_MAX_LENGTH, type RoadmapState, type StepAction as Action } from "@shared/roadmap";
import type { RevenueProvider } from "@shared/revenue";
import { roadmapStagesFor } from "@shared/roadmap-missions";
import { chatGptUrl, missionPromptText, PROMPT_TARGET } from "@shared/roadmap-prompts";
import type { Saas } from "@shared/saas";
import { IMAGE_TYPES, IMAGE_TYPES_LABEL } from "@shared/storage";
import { AddAccountForm } from "@/components/acquisition/AddAccountForm";
import { SaasAvatar } from "@/components/saas/SaasAvatar";
import { ConnectDialog, ProviderButton } from "@/components/revenue/ConnectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCheckFirstVideo, useTikTokAccounts } from "@/hooks/use-acquisition";
import { useAskGus } from "@/hooks/use-ask-gus";
import { useRefreshRevenue } from "@/hooks/use-revenue";
import { roadmapKeys, useSaveAppUrl, useSetPaymentLink } from "@/hooks/use-roadmap";
import { useSaasLogo } from "@/hooks/use-saas";
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
function PromptCopy({
  text,
  into,
  openInChatGpt = false,
  quiet = false,
}: {
  text: string;
  into: string;
  openInChatGpt?: boolean;
  /** Secondary buttons (a task already done: its next task's button comes first). */
  quiet?: boolean;
}) {
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
      <div className="flex flex-col gap-1 border-t border-border/60 p-2.5">
        {openInChatGpt && (
          <Button asChild variant={quiet ? "secondary" : "default"} className="w-full">
            <a href={chatGptUrl(text)} target="_blank" rel="noreferrer">
              Ouvrir ChatGPT <ExternalLink />
            </a>
          </Button>
        )}
        <Button
          variant={openInChatGpt ? "ghost" : quiet ? "secondary" : "default"}
          size={openInChatGpt ? "sm" : "default"}
          onClick={() => void copy()}
          className={openInChatGpt ? "text-muted-foreground" : "w-full"}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copié" : "Copier le message"}
        </Button>
      </div>
    </div>
  );
}

/**
 * The address of the member's app: checked from the browser, then saved (its mission gets done: the
 * drawer celebrates it). Also changed from the SaaS's settings (SaasGeneralSettings).
 */
function AppUrlForm({ saasId, appUrl }: { saasId: string; appUrl: string | null }) {
  const { save, busy } = useSaveAppUrl();
  const [url, setUrl] = useState(appUrl ?? "");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim() || busy) return;
    const saved = await save(saasId, url);
    if (saved) setUrl(saved);
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
          placeholder="https://mon-app.base44.app"
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
 * The Whop payment link of the member's app: checked by the server (a whop.com address), then saved.
 * Its task gets checked, and the payment prompt carries it.
 */
function PaymentLinkForm({ saasId, paymentLink }: { saasId: string; paymentLink: string | null }) {
  const { toast } = useToast();
  const setPaymentLink = useSetPaymentLink();
  const [url, setUrl] = useState(paymentLink ?? "");
  const busy = setPaymentLink.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim() || busy) return;
    try {
      const state = await setPaymentLink.mutateAsync({ saasId, url });
      if (state.project.paymentLink) setUrl(state.project.paymentLink);
      toast({ title: "Lien de paiement enregistré", description: "Il est déjà dans le message pour Base44." });
    } catch (error) {
      toast({ variant: "destructive", title: "Lien refusé", description: error instanceof ApiError ? error.message : "Réessaie dans un instant." });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Ton lien de paiement Whop"
          inputMode="url"
          value={url}
          maxLength={PAYMENT_LINK_MAX_LENGTH}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://whop.com/checkout/…"
          className="h-11"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={busy || !url.trim() || url.trim() === paymentLink}>
          {busy && <Loader2 className="animate-spin" />}
          Valider
        </Button>
      </div>
      {paymentLink && (
        <a href={paymentLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          Ouvrir ma page de paiement <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </form>
  );
}

/**
 * A TikTok account added by its @ right in its task (the form of the Statistiques page), to this SaaS.
 * Once added, the roadmap is read again: its task is checked from the accounts. Those already
 * followed are named under it, with the way to their statistics.
 */
function TikTokAccountForm({ saasId }: { saasId: string }) {
  const queryClient = useQueryClient();
  const accounts = useTikTokAccounts(saasId);
  const handles = (accounts.data ?? []).map((account) => `@${account.handle}`);
  return (
    <div className="space-y-2">
      <AddAccountForm saasId={saasId} onAdded={() => void queryClient.invalidateQueries({ queryKey: roadmapKeys.state(saasId) })} />
      {handles.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {handles.length > 1 ? "Déjà suivis" : "Déjà suivi"} : {handles.join(", ")}
          </span>
          <Link href="/acquisition" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            Ouvrir mes statistiques <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * The payment provider's button, right in its task: opens straight on its key form (the same as the
 * Paiements tab of the SaaS's settings). Closing it reads the roadmap again: once the account is
 * connected, its task is checked.
 */
function ConnectPaymentAccount({ saasId, provider }: { saasId: string; provider: RevenueProvider }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ProviderButton provider={provider} onClick={() => setOpen(true)} />
      <ConnectDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) void queryClient.invalidateQueries({ queryKey: roadmapKeys.state(saasId) });
        }}
        provider={provider}
        saasId={saasId}
      />
    </>
  );
}

/**
 * The payment test, checked right in its task: reads the connected payment account again now, then the
 * roadmap, whose task gets checked once a checkout went through on that account. Never ticked by hand:
 * until then, says what is missing.
 */
function TestPaymentCheck({ saasId, quiet }: { saasId: string; quiet: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refresh = useRefreshRevenue(saasId);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      const dashboard = await refresh.mutateAsync();
      await queryClient.refetchQueries({ queryKey: roadmapKeys.state(saasId) });
      const state = queryClient.getQueryData<RoadmapState>(roadmapKeys.state(saasId));
      const keys = roadmapStagesFor(state?.goal ?? 0)
        .flatMap((stage) => stage.missions)
        .filter((mission) => mission.check.kind === "test_payment")
        .map((mission) => mission.key);
      if (state && keys.some((key) => state.done[key])) return;
      const failure = dashboard.connections.find((connection) => connection.last_error)?.last_error;
      toast({
        variant: "destructive",
        title: "Pas encore de paiement test",
        description:
          failure ??
          (dashboard.connections.some((connection) => connection.livemode)
            ? "MakeSaaS ne le voit pas encore sur ton compte Whop : va jusqu'au bout du paiement dans ton app, puis réessaie dans une minute."
            : "Connecte d'abord le compte Whop de ton app (la tâche d'avant), puis réessaie."),
      });
    } catch {
      // useRefreshRevenue already said why.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={quiet ? "secondary" : "default"} className="w-full" onClick={check} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Vérifier mon paiement test
    </Button>
  );
}

/**
 * The first video, checked right in its task: reads the SaaS's TikTok accounts again now, then the
 * roadmap, whose task gets checked once a video is seen on them. Until then, says what is missing (a
 * private account, a failed read, or a video TikTok does not show yet).
 */
function FirstVideoCheck({ saasId }: { saasId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const checkVideo = useCheckFirstVideo(saasId);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      const accounts = await checkVideo.mutateAsync();
      await queryClient.refetchQueries({ queryKey: roadmapKeys.state(saasId) });
      const state = queryClient.getQueryData<RoadmapState>(roadmapKeys.state(saasId));
      if (state && state.progress.videos > 0) return;
      const failure = accounts.find((account) => account.sync_error)?.sync_error;
      const hidden = accounts.find((account) => account.is_private);
      const handles = accounts.map((account) => `@${account.handle}`).join(", ");
      toast({
        variant: "destructive",
        title: "Pas encore de vidéo",
        description:
          failure ??
          (hidden
            ? `@${hidden.handle} est privé : MakeSaaS ne voit pas ses vidéos. Passe-le en public dans TikTok, puis réessaie.`
            : `MakeSaaS ne voit encore aucune vidéo sur ${handles}. TikTok met parfois quelques minutes à la montrer : réessaie dans ${TIKTOK_FIRST_VIDEO_CHECK_MINUTES} min.`),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Vérification impossible",
        description: error instanceof ApiError ? error.message : "Réessaie dans un instant.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button className="w-full" onClick={check} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Vérifier ma vidéo
    </Button>
  );
}

/**
 * The SaaS's logo, right in its task: an image dropped on the zone, or picked by clicking it (the same
 * upload as the SaaS's settings: resized in the browser, stored by the server). Once saved, the
 * roadmap is read again: its task is checked from the logo.
 */
function LogoDrop({ saas }: { saas: Saas }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadLogo, isUploading } = useSaasLogo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file || isUploading) return;
    try {
      await uploadLogo({ saasId: saas.id, file });
      toast({ title: "Logo enregistré" });
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.state(saas.id) });
    } catch (error) {
      toast({ variant: "destructive", title: "Logo non enregistré", description: (error as Error).message });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        // Not when the drag only moves onto a child of the zone.
        onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void upload(event.dataTransfer.files[0]);
        }}
        disabled={isUploading}
        aria-label={saas.logo_url ? "Changer mon logo" : "Ajouter mon logo"}
        className={cn(
          "flex w-full items-center gap-4 rounded-xl border-2 border-dashed px-4 py-4 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-wait",
          over ? "border-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30 hover:bg-secondary/30",
        )}
        data-testid="logo-dropzone"
      >
        {saas.logo_url ? (
          <SaasAvatar name={saas.name} seed={saas.id} logoUrl={saas.logo_url} className="size-14 shrink-0 rounded-xl" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ImagePlus className="size-6" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">
            {isUploading ? "Envoi de ton logo…" : over ? "Lâche-le ici" : saas.logo_url ? "Ton logo est ajouté" : "Dépose ton logo ici"}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {saas.logo_url ? "Glisse une autre image, ou clique pour le changer." : `Ou clique pour le choisir (${IMAGE_TYPES_LABEL}).`}
          </span>
        </span>
        {isUploading ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
        ) : (
          saas.logo_url && <Check className="size-5 shrink-0 text-primary" strokeWidth={3} />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
        data-testid="input-logo-dropzone"
      />
    </>
  );
}

/**
 * The button of a mission's step, right under its text; `quiet`: secondary, for a task already done
 * (its buttons stay there to be used again, after the next task's).
 */
export function StepActionButton({ action, saas, state, quiet = false }: { action: Action; saas: Saas; state: RoadmapState; quiet?: boolean }) {
  const askGus = useAskGus();
  const variant = quiet ? "secondary" : "default";

  switch (action.kind) {
    case "open":
      return (
        <Button asChild variant={variant} className="w-full">
          <a href={action.url} target="_blank" rel="noreferrer">
            {action.label} <ExternalLink />
          </a>
        </Button>
      );
    case "page":
      return (
        <Button asChild variant={variant} className="w-full">
          <Link href={action.href}>
            {action.label} <ArrowRight />
          </Link>
        </Button>
      );
    case "chatgpt":
      return <PromptCopy text={missionPromptText(action.prompt, state.project)} into="ChatGPT" openInChatGpt quiet={quiet} />;
    case "copy":
      return <PromptCopy text={missionPromptText(action.prompt, state.project)} into={PROMPT_TARGET[action.prompt]} quiet={quiet} />;
    case "gus":
      return (
        <Button
          variant={variant}
          className="w-full"
          onClick={() => askGus(saas.id, action.message)}
        >
          <MessageCircle /> {action.label}
        </Button>
      );
    case "settings":
      return <LogoDrop saas={saas} />;
    case "payment_account":
      return <ConnectPaymentAccount saasId={saas.id} provider={action.provider} />;
    case "app_url":
      return <AppUrlForm saasId={saas.id} appUrl={state.appUrl} />;
    case "tiktok_account":
      return <TikTokAccountForm saasId={saas.id} />;
    case "payment_link":
      return <PaymentLinkForm saasId={saas.id} paymentLink={state.project.paymentLink ?? null} />;
    case "test_payment":
      return <TestPaymentCheck saasId={saas.id} quiet={quiet} />;
    case "first_video":
      // Once seen, nothing left to check: the video's figures are on the Statistiques page.
      return quiet ? (
        <Button asChild variant="secondary" className="w-full">
          <Link href="/acquisition">
            Voir mes statistiques <ArrowRight />
          </Link>
        </Button>
      ) : (
        <FirstVideoCheck saasId={saas.id} />
      );
  }
}
