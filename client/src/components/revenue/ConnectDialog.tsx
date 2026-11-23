import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ExternalLink, Loader2, Lock } from "lucide-react";
import { API_KEY_MAX_LENGTH, REVENUE_PROVIDERS, type RevenueProvider } from "@shared/revenue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConnectRevenue } from "@/hooks/use-revenue";
import { toast } from "@/hooks/use-toast";
import { tallInputClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { PROVIDERS, ProviderTile } from "./providers";

/** A provider to connect, as a big row: its logo, name and the kind of key it takes. */
export function ProviderButton({ provider, onClick, className }: { provider: RevenueProvider; onClick: () => void; className?: string }) {
  const { name, tagline } = PROVIDERS[provider];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-4 rounded-[14px] border border-border bg-background/40 p-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <ProviderTile provider={provider} className="h-11 w-11 rounded-[12px]" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{name}</span>
        <span className="block text-sm text-muted-foreground">{tagline}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

type ConnectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens on this provider's key form; otherwise the member picks one first. */
  provider: RevenueProvider | null;
  /** The SaaS the account is connected to. */
  saasId: string;
};

/** Connects a payment account with a read-only key: pick the provider, follow the steps, paste the key. */
export function ConnectDialog({ open, onOpenChange, provider: initialProvider, saasId }: ConnectDialogProps) {
  const [provider, setProvider] = useState<RevenueProvider | null>(initialProvider);
  const [apiKey, setApiKey] = useState("");
  const connect = useConnectRevenue();

  // Each opening starts over (on the provider it was opened for).
  useEffect(() => {
    if (open) {
      setProvider(initialProvider);
      setApiKey("");
      connect.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialProvider]);

  const info = provider ? PROVIDERS[provider] : null;

  const submit = () => {
    if (!provider || !apiKey.trim() || connect.isPending) return;
    connect.mutate(
      { saasId, provider, apiKey: apiKey.trim() },
      {
        onSuccess: (connection) => {
          toast({
            title: `${PROVIDERS[provider].name} connecté`,
            description: connection.account_name ? `${connection.account_name} est maintenant suivi.` : "Tes chiffres sont importés.",
          });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !connect.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        {!info || !provider ? (
          <>
            <DialogHeader>
              <DialogTitle>Connecter un compte</DialogTitle>
              <DialogDescription>
                D'où viennent les paiements de ton SaaS ? Tu connectes un seul compte par SaaS.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5">
              {REVENUE_PROVIDERS.map((key) => (
                <ProviderButton key={key} provider={key} onClick={() => setProvider(key)} />
              ))}
            </div>
          </>
        ) : (
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <ProviderTile provider={provider} className="h-9 w-9 rounded-[10px]" />
                Connecter {info.name}
              </DialogTitle>
              <DialogDescription>Une clé en lecture seule suffit : MakeSaaS lit tes paiements, sans jamais rien modifier.</DialogDescription>
            </DialogHeader>

            <ol className="space-y-2.5 text-sm text-muted-foreground">
              {info.steps.map((step, index) => (
                <li key={index} className="flex gap-3 [&_code]:text-foreground [&_strong]:font-medium [&_strong]:text-foreground">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <Button asChild variant="outline" className="justify-self-start">
              <a href={info.keyUrl} target="_blank" rel="noreferrer">
                Créer la clé sur {info.name}
                <ExternalLink />
              </a>
            </Button>

            <div className="space-y-2">
              <Label htmlFor="revenue-api-key">{info.keyLabel}</Label>
              <Input
                id="revenue-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                value={apiKey}
                maxLength={API_KEY_MAX_LENGTH}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={info.keyPlaceholder}
                className={tallInputClass}
                aria-invalid={connect.isError}
                aria-describedby={connect.isError ? "revenue-api-key-error" : undefined}
                data-testid="input-revenue-api-key"
              />
              {connect.isError && (
                <p id="revenue-api-key-error" role="alert" className="text-sm text-destructive">
                  {connect.error.message}
                </p>
              )}
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lock className="mt-px size-3.5 shrink-0" />
                Ta clé est chiffrée avant d'être enregistrée et n'est jamais renvoyée à ton navigateur. Tu peux la révoquer à tout moment.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {initialProvider === null ? (
                <Button type="button" variant="ghost" onClick={() => setProvider(null)} disabled={connect.isPending}>
                  <ArrowLeft /> Retour
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={!apiKey.trim() || connect.isPending} data-testid="button-connect-revenue">
                {connect.isPending && <Loader2 className="animate-spin" />}
                {connect.isPending ? "Import de ton historique…" : "Connecter"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
