import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useUpdateAdminUser, type AdminUserDetailsResponse } from "@/hooks/use-admin-profiles";
import { formatDateTime, getInitials } from "@/lib/format";
import { ConfirmRoleChangeDialog } from "../ConfirmRoleChangeDialog";

export function ProfileCard({ profile }: { profile: AdminUserDetailsResponse["profile"] }) {
  const updateUser = useUpdateAdminUser();

  const toggleRole = () =>
    updateUser.mutate({ id: profile.id, updates: { role: profile.role === "admin" ? "user" : "admin" } });

  const dates = [
    { label: "Inscription", value: profile.createdAt },
    { label: "Dernière connexion", value: profile.lastSignInAt },
    { label: "Dernière activité", value: profile.lastActiveAt },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Profil utilisateur</CardTitle>
        <CardDescription>Informations principales du compte.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.email || "Avatar"} referrerPolicy="no-referrer" /> : null}
            <AvatarFallback>{getInitials(profile.fullName || profile.email)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-base font-semibold">{profile.fullName || "Nom non renseigné"}</p>
            <p className="text-sm text-muted-foreground">{profile.email || "Email non renseigné"}</p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Rôle</p>
            <ConfirmRoleChangeDialog profile={profile} onConfirm={toggleRole} />
          </div>
          {dates.map((date) => (
            <div key={date.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{date.label}</p>
              <p className="text-sm font-medium">{formatDateTime(date.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
