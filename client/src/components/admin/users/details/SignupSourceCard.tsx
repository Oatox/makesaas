import type { SignupSource } from "@shared/schema";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

function referrerHost(referrer: string | null | undefined) {
  if (!referrer) return null;

  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function signupSourceLabel(source: SignupSource) {
  return source.utm_source || source.ref || referrerHost(source.referrer) || "Accès direct";
}

export function SignupSourceCard({ source }: { source: SignupSource | null }) {
  const rows: { label: string; value: string | null | undefined }[] = source
    ? [
        { label: "Site référent", value: source.referrer },
        { label: "Code de parrainage (ref)", value: source.ref },
        { label: "utm_source", value: source.utm_source },
        { label: "utm_medium", value: source.utm_medium },
        { label: "utm_campaign", value: source.utm_campaign },
        { label: "utm_term", value: source.utm_term },
        { label: "utm_content", value: source.utm_content },
        { label: "Page d'arrivée", value: source.landing_path },
        { label: "Première visite", value: source.captured_at ? formatDateTime(source.captured_at) : null },
      ].filter((row) => row.value)
    : [];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Megaphone className="h-5 w-5 text-muted-foreground" />
          Provenance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!source ? (
          <p className="text-sm text-muted-foreground">
            Aucune donnée de provenance pour ce compte (inscrit avant le suivi, ou stockage bloqué par le navigateur).
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Source</span>
              <Badge variant="secondary" className="text-sm">
                {signupSourceLabel(source)}
              </Badge>
            </div>
            {rows.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                  <div key={row.label} className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="break-all text-sm font-medium">{row.value}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
