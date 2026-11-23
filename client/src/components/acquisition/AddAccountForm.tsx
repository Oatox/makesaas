import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { normalizeTikTokHandle } from "@shared/acquisition";
import type { TikTokAccount } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useAddTikTokAccount } from "@/hooks/use-acquisition";
import { fieldClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

type AddAccountFormProps = {
  onAdded?: (account: TikTokAccount) => void;
  autoFocus?: boolean;
  /** The SaaS the account is added to; the active one by default. */
  saasId?: string;
};

/** "@pseudo" field + button. The server checks the account exists and fetches its stats (a few seconds). */
export function AddAccountForm({ onAdded, autoFocus, saasId }: AddAccountFormProps) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const add = useAddTikTokAccount(saasId);
  const error = localError ?? (add.isError ? add.error.message : null);

  return (
    <form
      className="w-full space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const handle = normalizeTikTokHandle(value);
        if (!handle) {
          setLocalError("Entre un pseudo TikTok valide, par exemple @moncompte.");
          return;
        }
        add.mutate(handle, {
          onSuccess: (account) => {
            setValue("");
            onAdded?.(account);
          },
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* The @ stays in front of the input: a wrapper carries the field look and focus ring. It only
            grows in the row (sm up): `flex-1` in the phone column would collapse its height. */}
        <label className={cn(fieldClass, "flex h-11 shrink-0 items-center gap-1 sm:h-10 sm:flex-1 sm:shrink")}>
          <span aria-hidden className="text-muted-foreground">@</span>
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setLocalError(null);
              add.reset();
            }}
            placeholder="pseudo ou lien du profil TikTok"
            aria-label="Pseudo TikTok"
            aria-invalid={!!error}
            autoFocus={autoFocus}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={add.isPending}
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            data-testid="input-tiktok-handle"
          />
        </label>
        <Button type="submit" disabled={!value.trim() || add.isPending} data-testid="button-add-tiktok-account">
          {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {add.isPending ? "Récupération des stats…" : "Ajouter"}
        </Button>
      </div>
      {error && (
        <p className="text-left text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
