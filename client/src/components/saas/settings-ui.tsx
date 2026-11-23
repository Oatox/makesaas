import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A connected item in the SaaS settings (TikTok account, payment account): same look as the provider buttons. */
export const settingsRowClass = "flex items-center gap-3 rounded-[14px] border border-border bg-background/40 p-3";

/** A tab of the SaaS settings whose data failed to load. */
export function SettingsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card-3d card-3d-danger flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <p className="flex min-w-0 flex-1 items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        Réessayer
      </Button>
    </div>
  );
}
