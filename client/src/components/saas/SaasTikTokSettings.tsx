import { useState } from "react";
import { AlertTriangle, BadgeCheck, Loader2, Trash2 } from "lucide-react";
import { TIKTOK_MAX_ACCOUNTS } from "@shared/acquisition";
import type { Saas } from "@shared/saas";
import type { TikTokAccount } from "@shared/schema";
import { AddAccountForm } from "@/components/acquisition/AddAccountForm";
import { TikTokAvatar } from "@/components/acquisition/TikTokAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteTikTokAccount, useSyncingAccountIds, useTikTokAccounts } from "@/hooks/use-acquisition";
import { formatCompact } from "@/lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { settingsRowClass, SettingsError } from "./settings-ui";

function AccountRow({ account, isSyncing, onRemove }: { account: TikTokAccount; isSyncing: boolean; onRemove: () => void }) {
  return (
    <li className={settingsRowClass} data-testid={`saas-tiktok-${account.handle}`}>
      <TikTokAvatar account={account} className="h-10 w-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{account.nickname || `@${account.handle}`}</span>
          {account.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Compte certifié" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <a
            href={`https://www.tiktok.com/@${account.handle}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground hover:underline"
          >
            @{account.handle}
          </a>
          {" · "}
          <span className="tabular-nums">{formatCompact(account.followers)}</span> abonné{account.followers > 1 ? "s" : ""}
        </p>
        {isSyncing ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Actualisation…
          </p>
        ) : (
          account.sync_error && (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> {account.sync_error}
            </p>
          )
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Retirer @${account.handle}`}
        title="Retirer"
        className="-mr-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </li>
  );
}

/**
 * "Comptes TikTok" tab of the SaaS settings: the accounts tracked for this SaaS on the acquisition
 * page, to remove one or add another (same Supabase queries and server route as that page).
 */
export function SaasTikTokSettings({ saas }: { saas: Saas }) {
  const accounts = useTikTokAccounts(saas.id);
  const remove = useDeleteTikTokAccount();
  const syncing = useSyncingAccountIds();
  // The account stays set while the confirmation closes, so its title does not change on the way out.
  const [toRemove, setToRemove] = useState<TikTokAccount | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (accounts.isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Chargement des comptes TikTok">
        <Skeleton className="h-[66px] rounded-[14px]" />
        <Skeleton className="h-[66px] rounded-[14px]" />
      </div>
    );
  }
  if (accounts.isError) {
    return <SettingsError message="Impossible de charger les comptes TikTok." onRetry={() => void accounts.refetch()} />;
  }

  const list = accounts.data;
  const isFull = list.length >= TIKTOK_MAX_ACCOUNTS;

  return (
    <div className="space-y-4">
      {/* No account yet: the add form alone says it all. */}
      {list.length > 0 && (
        <ul className="space-y-2" aria-label={`Comptes TikTok de ${saas.name}`}>
          {list.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isSyncing={syncing.includes(account.id)}
              onRemove={() => {
                setToRemove(account);
                setConfirmOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      {isFull ? (
        <p className="text-xs text-muted-foreground">
          {TIKTOK_MAX_ACCOUNTS} comptes maximum : retires-en un pour en ajouter un autre.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Ajouter un compte</p>
          <AddAccountForm saasId={saas.id} />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Retirer @${toRemove?.handle ?? ""} ?`}
        description="Ses vidéos et l'historique de ses statistiques seront supprimés. Tu pourras le rajouter plus tard, mais l'historique repartira de zéro."
        confirmLabel="Retirer"
        onConfirm={() => (toRemove ? remove.mutateAsync(toRemove) : Promise.resolve())}
        isPending={remove.isPending}
        testId="button-saas-tiktok-remove-confirm"
      />
    </div>
  );
}
