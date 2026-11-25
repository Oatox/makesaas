import { useState } from "react";
import { AlertCircle, Loader2, Plus, Users } from "lucide-react";
import { TIKTOK_MAX_ACCOUNTS } from "@shared/acquisition";
import type { TikTokAccount } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSyncingAccountIds } from "@/hooks/use-acquisition";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddAccountForm } from "./AddAccountForm";
import { TikTokAvatar } from "./TikTokAvatar";

/** Value of the picker: every account at once, or one account id. */
export const ALL_ACCOUNTS = "all";

const pillClass =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const idleClass = "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground";
const activeClass = "border-primary/40 bg-primary/10 text-foreground";

/** Row of pills to pick the account the page shows, and the button to add one. */
export function AccountPicker({
  accounts,
  selected,
  onSelect,
}: {
  accounts: TikTokAccount[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const syncing = useSyncingAccountIds();
  const isFull = accounts.length >= TIKTOK_MAX_ACCOUNTS;

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Comptes TikTok">
      {accounts.length > 1 && (
        <button
          type="button"
          aria-pressed={selected === ALL_ACCOUNTS}
          onClick={() => onSelect(ALL_ACCOUNTS)}
          className={cn(pillClass, selected === ALL_ACCOUNTS ? activeClass : idleClass)}
        >
          <Users className="size-4" aria-hidden />
          Tous les comptes
        </button>
      )}

      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          aria-pressed={selected === account.id}
          onClick={() => onSelect(account.id)}
          className={cn(pillClass, "pl-1.5", selected === account.id ? activeClass : idleClass)}
          data-testid={`tab-tiktok-${account.handle}`}
        >
          <TikTokAvatar account={account} className="h-7 w-7" />
          <span>@{account.handle}</span>
          <span className="tabular-nums text-muted-foreground">{formatCompact(account.followers)}</span>
          {syncing.includes(account.id) ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Actualisation en cours" />
          ) : (
            account.sync_error && <AlertCircle className="size-3.5 text-destructive" aria-label="Dernière actualisation en échec" />
          )}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setAdding(true)}
        disabled={isFull}
        aria-label="Ajouter un compte"
        title={isFull ? `${TIKTOK_MAX_ACCOUNTS} comptes maximum : retires-en un pour en ajouter un autre.` : "Ajouter un compte"}
        className={cn(pillClass, idleClass, "w-10 justify-center border-dashed px-0 disabled:cursor-not-allowed disabled:opacity-50")}
        data-testid="button-open-add-tiktok-account"
      >
        <Plus className="size-4" aria-hidden />
      </button>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un compte TikTok</DialogTitle>
            <DialogDescription>
              Le compte doit être public. On récupère ses abonnés et les stats de ses dernières vidéos.
            </DialogDescription>
          </DialogHeader>
          <AddAccountForm
            autoFocus
            onAdded={(account) => {
              setAdding(false);
              onSelect(account.id);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
