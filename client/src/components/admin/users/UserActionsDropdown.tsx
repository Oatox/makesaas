import type { Profile } from "@shared/schema";
import { grantsAccess, type SubscriptionSummary } from "@shared/billing";
import { BadgeMinus, Gift, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteUserDialog } from "./DeleteUserDialog";

export function UserActionsDropdown({
  profile,
  onToggleSubscriber,
  onDelete,
}: {
  profile: Pick<Profile, "email"> & { subscription: Pick<SubscriptionSummary, "status"> | null };
  onToggleSubscriber: () => void;
  onDelete: () => void;
}) {
  const hasAccess = grantsAccess(profile.subscription?.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full text-muted-foreground md:h-8 md:w-8 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <MoreHorizontal className="!size-5 md:!size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>Actions utilisateur</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onToggleSubscriber}>
          {hasAccess ? <BadgeMinus /> : <Gift />}
          {hasAccess ? "Retirer l'abonnement" : "Offrir l'abonnement"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DeleteUserDialog profile={profile} onDelete={onDelete} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
