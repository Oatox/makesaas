import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Loader2, Unplug } from "lucide-react";
import { REVENUE_PROVIDERS, type RevenueConnection, type RevenueProvider } from "@shared/revenue";
import type { Saas } from "@shared/saas";
import { ConnectDialog, ProviderButton } from "@/components/revenue/ConnectDialog";
import { PROVIDERS, ProviderTile } from "@/components/revenue/providers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRemoveRevenueConnection, useRevenueDashboard } from "@/hooks/use-revenue";
import { ConfirmDialog } from "./ConfirmDialog";
import { settingsRowClass, SettingsError } from "./settings-ui";

const timeAgo = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: fr });

const connectionName = (connection: RevenueConnection) => connection.account_name ?? PROVIDERS[connection.provider].name;

function ConnectionRow({ connection, isSyncing, onDisconnect }: { connection: RevenueConnection; isSyncing: boolean; onDisconnect: () => void }) {
  return (
    <li className={settingsRowClass} data-testid={`saas-payment-${connection.provider}`}>
      <ProviderTile provider={connection.provider} className="h-10 w-10 rounded-[11px]" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{connectionName(connection)}</span>
          {!connection.livemode && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Test</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {PROVIDERS[connection.provider].name} · clé ••••{connection.key_hint}
        </p>
        {isSyncing ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Synchronisation…
          </p>
        ) : connection.last_error ? (
          <p className="mt-0.5 flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> {connection.last_error}
          </p>
        ) : (
          connection.last_synced_at && (
            <p className="mt-0.5 text-xs text-muted-foreground">Synchronisé {timeAgo(connection.last_synced_at)}</p>
          )
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDisconnect}
        aria-label="Déconnecter"
        title="Déconnecter"
        className="-mr-1 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive max-sm:size-9 max-sm:px-0"
        data-testid="button-saas-payment-disconnect"
      >
        <Unplug /> <span className="hidden sm:inline">Déconnecter</span>
      </Button>
    </li>
  );
}

/**
 * "Paiements" tab of the SaaS settings: the Stripe or Whop account the revenue dashboard reads for
 * this SaaS (a single one), to disconnect it or connect one. Same query as the dashboard, so both
 * stay in step.
 */
export function SaasPaymentSettings({ saas }: { saas: Saas }) {
  const dashboard = useRevenueDashboard(saas.id);
  const remove = useRemoveRevenueConnection(saas.id);
  // The account stays set while the confirmation closes, so its title does not change on the way out.
  const [toRemove, setToRemove] = useState<RevenueConnection | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState<RevenueProvider | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  if (dashboard.isPending) {
    return (
      <div aria-busy="true" aria-label="Chargement du compte de paiement">
        <Skeleton className="h-[66px] rounded-[14px]" />
      </div>
    );
  }
  if (dashboard.isError) {
    return <SettingsError message={dashboard.error.message || "Impossible de charger le compte de paiement."} onRetry={() => void dashboard.refetch()} />;
  }

  const { connections, syncing } = dashboard.data;

  return (
    <div className="space-y-4">
      {connections.length === 0 ? (
        <div className="space-y-2.5">
          <p className="text-sm font-medium">Connecter un compte</p>
          {REVENUE_PROVIDERS.map((provider) => (
            <ProviderButton
              key={provider}
              provider={provider}
              onClick={() => {
                setConnectProvider(provider);
                setConnectOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <ul className="space-y-2" aria-label={`Compte de paiement de ${saas.name}`}>
            {connections.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                isSyncing={syncing.includes(connection.id)}
                onDisconnect={() => {
                  setToRemove(connection);
                  setConfirmOpen(true);
                }}
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Un seul compte par SaaS : déconnecte celui-ci pour en connecter un autre.</p>
        </>
      )}

      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} provider={connectProvider} saasId={saas.id} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Déconnecter ${toRemove ? connectionName(toRemove) : "ce compte"} ?`}
        description={`Ses chiffres disparaissent du tableau de bord de ${saas.name} et sa clé est supprimée. Tu pourras le reconnecter à tout moment.`}
        confirmLabel="Déconnecter"
        onConfirm={() => (toRemove ? remove.mutateAsync(toRemove.id) : Promise.resolve())}
        isPending={remove.isPending}
        testId="button-saas-payment-disconnect-confirm"
      />
    </div>
  );
}
