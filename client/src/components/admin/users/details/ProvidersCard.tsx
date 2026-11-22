import { Clock3, Globe, Mail, ShieldCheck, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUserDetailsResponse } from "@/hooks/use-admin-profiles";
import { formatDateTime } from "@/lib/format";

function providerLabel(provider: string) {
  const normalized = provider.trim().toLowerCase();

  if (normalized === "google") return "Google";
  if (normalized === "email") return "Email";
  if (normalized === "github") return "GitHub";

  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Inconnu";
}

function ProviderIcon({ provider }: { provider: string }) {
  const Icon = provider === "email" ? Mail : provider === "google" ? Globe : UserCircle2;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

export function ProvidersCard({ providers }: { providers: AdminUserDetailsResponse["providers"] }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Fournisseurs d’authentification</CardTitle>
        <CardDescription>Méthodes de connexion actuellement liées au compte.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fournisseur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Connecté le</TableHead>
                <TableHead>Dernière connexion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    Aucun fournisseur trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProviderIcon provider={provider.provider} />
                        <span className="font-medium">{providerLabel(provider.provider)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Connecté
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(provider.connectedAt)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(provider.lastSignInAt)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
