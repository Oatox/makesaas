import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, BadgeCheck, ExternalLink, Loader2, Lock, RefreshCw, Trash2 } from "lucide-react";
import { TIKTOK_SYNC_COOLDOWN_MINUTES } from "@shared/acquisition";
import type { TikTokAccount } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { canSyncNow, useDeleteTikTokAccount, useSyncingAccountIds, useSyncTikTokAccount } from "@/hooks/use-acquisition";
import { TikTokAvatar } from "./TikTokAvatar";

function SyncStatus({ account, isSyncing }: { account: TikTokAccount; isSyncing: boolean }) {
  if (isSyncing) return <span>Actualisation en cours…</span>;
  if (account.sync_error) {
    return (
      <span className="flex items-start gap-1.5 text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {account.sync_error}
      </span>
    );
  }
  if (!account.synced_at) return <span>Pas encore actualisé</span>;
  return <span>Actualisé {formatDistanceToNow(new Date(account.synced_at), { addSuffix: true, locale: fr })}</span>;
}

/** Card of the selected account: identity, freshness of its stats, refresh and removal. */
export function AccountHeader({ account, onRemoved }: { account: TikTokAccount; onRemoved: () => void }) {
  const sync = useSyncTikTokAccount();
  const remove = useDeleteTikTokAccount();
  const isSyncing = useSyncingAccountIds().includes(account.id);
  const canSync = canSyncNow(account) && !isSyncing;

  return (
    <section className="card-3d flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <TikTokAvatar account={account} className="h-14 w-14 text-xl" />
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-1.5 truncate font-display text-lg">
            {account.nickname || `@${account.handle}`}
            {account.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Compte certifié" />}
          </p>
          <a
            href={`https://www.tiktok.com/@${account.handle}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            @{account.handle}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <div className="text-xs text-muted-foreground">
            <SyncStatus account={account} isSyncing={isSyncing} />
          </div>
          {account.is_private && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden /> Compte privé : seules les stats du profil sont visibles.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          disabled={!canSync}
          title={
            canSync || isSyncing
              ? undefined
              : `Une actualisation toutes les ${TIKTOK_SYNC_COOLDOWN_MINUTES} minutes au plus.`
          }
          onClick={() => sync.mutate({ id: account.id })}
          data-testid="button-sync-tiktok-account"
        >
          {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Actualiser
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Retirer @${account.handle}`} className="text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Retirer @{account.handle} ?</AlertDialogTitle>
              <AlertDialogDescription>
                Ses vidéos et l'historique de ses statistiques seront supprimés. Tu pourras le rajouter plus tard,
                mais l'historique repartira de zéro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => remove.mutate(account, { onSuccess: onRemoved })}
              >
                Retirer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
