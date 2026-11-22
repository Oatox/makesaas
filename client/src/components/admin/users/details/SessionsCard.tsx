import { AlertCircle, Laptop, Loader2, ShieldX, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useRevokeAdminSession,
  useRevokeAllAdminSessions,
  type AdminUserDetailsResponse,
} from "@/hooks/use-admin-profiles";
import { formatDateTime } from "@/lib/format";

type SessionsCardProps = {
  userId: string;
  sessions: AdminUserDetailsResponse["sessions"];
  sessionsUnavailable: boolean;
};

export function SessionsCard({ userId, sessions, sessionsUnavailable }: SessionsCardProps) {
  const revokeSession = useRevokeAdminSession(userId);
  const revokeAll = useRevokeAllAdminSessions(userId);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Sessions actives</CardTitle>
            <CardDescription>Liste des sessions actives et expirées de l’utilisateur.</CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={revokeAll.isPending || sessions.length === 0}>
                {revokeAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                Révoquer toutes les sessions
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Révoquer toutes les sessions ?</AlertDialogTitle>
                <AlertDialogDescription>
                  L'utilisateur sera déconnecté de tous ses appareils. Cette action ne peut pas être annulée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => revokeAll.mutate()} variant="destructive">
                  Révoquer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {sessionsUnavailable ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sessions indisponibles</AlertTitle>
            <AlertDescription>
              Les sessions n’ont pas pu être chargées depuis votre projet Supabase. Vérifiez les permissions d’accès au schéma auth.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Appareil</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    Aucune session trouvée.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => {
                  // Spinner on the row being revoked only.
                  const isRevoking = revokeSession.isPending && revokeSession.variables === session.id;

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{session.device}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{session.ipAddress || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={session.status === "active" ? "default" : "secondary"}>
                          {session.status === "active" ? "Actif" : "Expiré"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDateTime(session.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={revokeSession.isPending}
                              aria-label="Supprimer la session"
                            >
                              {isRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                La session {session.device} sera révoquée immédiatement
                                {session.ipAddress ? ` depuis l'adresse IP ${session.ipAddress}` : ""}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => revokeSession.mutate(session.id)} variant="destructive">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
