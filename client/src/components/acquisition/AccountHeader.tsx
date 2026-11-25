import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, BadgeCheck, ExternalLink, Lock } from "lucide-react";
import { syncedToday } from "@shared/acquisition";
import type { TikTokAccount } from "@shared/schema";
import { useSyncingAccountIds } from "@/hooks/use-acquisition";
import { TikTokAvatar } from "./TikTokAvatar";

function SyncStatus({ account, isSyncing }: { account: TikTokAccount; isSyncing: boolean }) {
  if (isSyncing) return <span>Analyse du jour en cours…</span>;
  if (account.sync_error) {
    return (
      <span className="flex items-start gap-1.5 text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {account.sync_error}
      </span>
    );
  }
  if (!account.synced_at) return <span>Pas encore analysé</span>;
  return (
    <span title="Les stats de chaque compte sont analysées automatiquement, une fois par jour.">
      Actualisé {formatDistanceToNow(new Date(account.synced_at), { addSuffix: true, locale: fr })}
      {syncedToday(account.sync_attempted_at) && " · prochaine analyse demain"}
    </span>
  );
}

/**
 * The selected account, straight on the page (no card, no button): its identity and the freshness of
 * its stats. The page analyzes each account by itself once a day (useAutoSyncTikTokAccounts), and
 * accounts are removed from the SaaS's settings (TikTok tab).
 */
export function AccountHeader({ account }: { account: TikTokAccount }) {
  const isSyncing = useSyncingAccountIds().includes(account.id);

  return (
    <section className="flex min-w-0 items-center gap-4">
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
    </section>
  );
}
