import { useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { COACH_TITLE_MAX_LENGTH, type CoachConversation } from "@shared/coach";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDeleteConversation, useRenameConversation } from "@/hooks/use-coach";
import { useToast } from "@/hooks/use-toast";
import { translateSupabaseError } from "@/lib/error-translator";

/** Which discussion is being renamed or deleted, from the sidebar or the discussion's page. */
export type DiscussionDialogState = { mode: "rename" | "delete"; conversation: CoachConversation } | null;

function RenameDialog({ conversation, onClose }: { conversation: CoachConversation; onClose: () => void }) {
  const rename = useRenameConversation();
  const { toast } = useToast();
  const [title, setTitle] = useState(conversation.title);
  const trimmed = title.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || rename.isPending) return;
    if (trimmed === conversation.title) return onClose();
    try {
      await rename.mutateAsync({ id: conversation.id, title: trimmed });
      onClose();
    } catch (error) {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Renommage impossible") });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renommer la discussion</DialogTitle>
          <DialogDescription>Un titre court pour la retrouver facilement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={COACH_TITLE_MAX_LENGTH}
            autoComplete="off"
            autoFocus
            aria-label="Titre de la discussion"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={rename.isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={!trimmed || rename.isPending}>
              {rename.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ conversation, onClose }: { conversation: CoachConversation; onClose: () => void }) {
  const remove = useDeleteConversation();
  const { toast } = useToast();

  const confirm = async () => {
    try {
      await remove.mutateAsync(conversation);
      toast({ title: "Discussion supprimée" });
      onClose();
    } catch (error) {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Suppression impossible") });
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette discussion ?</AlertDialogTitle>
          <AlertDialogDescription>
            « {conversation.title} » et tous ses messages seront supprimés définitivement. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            disabled={remove.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The rename or delete dialog of a discussion, whichever `state` asks for. */
export function DiscussionDialogs({ state, onClose }: { state: DiscussionDialogState; onClose: () => void }) {
  if (state?.mode === "rename") return <RenameDialog conversation={state.conversation} onClose={onClose} />;
  if (state?.mode === "delete") return <DeleteDialog conversation={state.conversation} onClose={onClose} />;
  return null;
}
