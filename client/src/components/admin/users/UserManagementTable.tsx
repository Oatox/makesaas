import { useLocation } from "wouter";
import { grantsAccess } from "@shared/billing";
import { ChevronLeft, ChevronRight, Clock, Filter, Mail, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminProfileRow } from "@/hooks/use-admin-profiles";
import { formatDate, getInitials } from "@/lib/format";
import { ConfirmRoleChangeDialog } from "./ConfirmRoleChangeDialog";
import { UserActionsDropdown } from "./UserActionsDropdown";

type UserManagementTableProps = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
  profiles: AdminProfileRow[];
  onToggleRole: (id: string, currentRole: AdminProfileRow["role"]) => void;
  onToggleSubscriber: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  page: number;
  totalPages: number;
  isFetching: boolean;
  isPlaceholderData: boolean;
  onPageChange: (page: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

const ROLE_FILTERS = [
  { value: "all", label: "Tous les rôles" },
  { value: "user", label: "Utilisateurs" },
  { value: "admin", label: "Administrateurs" },
  { value: "subscriber", label: "Abonnés" },
];

// Pieces shared by the desktop table and the mobile cards.
/** The user's photo (from their Google account), or their initials. */
function UserIdentity({ profile }: { profile: AdminProfileRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-10 w-10 shrink-0">
        {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {getInitials(profile.full_name || profile.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium transition-colors group-hover:text-primary">{profile.full_name || "N/A"}</span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{profile.email}</span>
        </span>
      </div>
    </div>
  );
}

function SubscriberBadge({ profile }: { profile: AdminProfileRow }) {
  const subscribed = grantsAccess(profile.subscription?.status);
  return <Badge variant={subscribed ? "default" : "secondary"}>{subscribed ? "Oui" : "Non"}</Badge>;
}

function JoinDate({ profile }: { profile: AdminProfileRow }) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <Clock className="h-3 w-3 shrink-0" />
      <span>{formatDate(profile.created_at)}</span>
    </div>
  );
}

const stopRowClick = (e: React.MouseEvent) => e.stopPropagation();

export function UserManagementTable({
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
  profiles,
  onToggleRole,
  onToggleSubscriber,
  onDelete,
  page,
  totalPages,
  isFetching,
  isPlaceholderData,
  onPageChange,
  onPreviousPage,
  onNextPage,
}: UserManagementTableProps) {
  const [, navigate] = useLocation();

  const pageNumbers =
    totalPages <= 3
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : page === 1
        ? [1, 2, 3]
        : page === totalPages
          ? [totalPages - 2, totalPages - 1, totalPages]
          : [page - 1, page, page + 1];

  const openUser = (id: string) => navigate(`/admin/users/${id}`);

  return (
    <div className="space-y-4">
      <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="sm:w-[210px]">
            {/* A div, not a span: SelectTrigger line-clamps its direct spans, which would stack the icon over the label. */}
            <div className="flex min-w-0 items-center gap-2.5">
              <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                <SelectValue placeholder="Tous les rôles" />
              </span>
            </div>
          </SelectTrigger>
          <SelectContent align="end" className="min-w-[210px]">
            {ROLE_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/70 hover:bg-transparent">
              <TableHead>Utilisateur</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Abonné</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <TableRow
                  key={profile.id}
                  // Clickable row: lighter background, orange edge on the left and orange name on hover.
                  className="group cursor-pointer border-b border-border/60 transition-[background-color,box-shadow] duration-150 last:border-b-0 hover:bg-secondary/70 hover:shadow-[inset_3px_0_0_hsl(var(--primary))]"
                  onClick={() => openUser(profile.id)}
                >
                  <TableCell>
                    <UserIdentity profile={profile} />
                  </TableCell>
                  <TableCell onClick={stopRowClick}>
                    <ConfirmRoleChangeDialog profile={profile} onConfirm={() => onToggleRole(profile.id, profile.role)} />
                  </TableCell>
                  <TableCell>
                    <SubscriberBadge profile={profile} />
                  </TableCell>
                  <TableCell>
                    <JoinDate profile={profile} />
                  </TableCell>
                  <TableCell className="text-right" onClick={stopRowClick}>
                    <UserActionsDropdown
                      profile={profile}
                      onToggleSubscriber={() => onToggleSubscriber(profile.id, grantsAccess(profile.subscription?.status))}
                      onDelete={() => onDelete(profile.id)}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: one card per user instead of a 5-column table */}
      <div className="space-y-3 md:hidden">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <div
              key={profile.id}
              role="link"
              tabIndex={0}
              onClick={() => openUser(profile.id)}
              onKeyDown={(e) => e.key === "Enter" && openUser(profile.id)}
              className="card-3d cursor-pointer space-y-3 p-4 transition-colors active:brightness-110"
            >
              <div className="flex items-start justify-between gap-3">
                <UserIdentity profile={profile} />
                <div className="-mr-2 -mt-1 shrink-0" onClick={stopRowClick}>
                  <UserActionsDropdown
                    profile={profile}
                    onToggleSubscriber={() => onToggleSubscriber(profile.id, grantsAccess(profile.subscription?.status))}
                    onDelete={() => onDelete(profile.id)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-3">
                <div onClick={stopRowClick}>
                  <ConfirmRoleChangeDialog profile={profile} onConfirm={() => onToggleRole(profile.id, profile.role)} />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Abonné <SubscriberBadge profile={profile} />
                </div>
                <div className="ml-auto">
                  <JoinDate profile={profile} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
            Aucun utilisateur trouvé.
          </p>
        )}
      </div>

      <div className="mt-4 flex w-full justify-center sm:justify-end">
        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreviousPage}
            disabled={page <= 1 || isFetching}
            className="min-h-11 gap-1 px-3 text-muted-foreground hover:text-foreground disabled:opacity-40 md:min-h-8 md:px-2"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Précédent
          </Button>
          {pageNumbers.map((pageNumber) => (
            <Button
              key={pageNumber}
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(pageNumber)}
              disabled={isFetching}
              className={`hidden h-8 w-8 rounded-md px-0 sm:inline-flex ${
                pageNumber === page ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={onNextPage}
            disabled={page >= totalPages || isFetching || isPlaceholderData}
            className="min-h-11 gap-1 px-3 text-muted-foreground hover:text-foreground disabled:opacity-40 md:min-h-8 md:px-2"
          >
            Suivant
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
