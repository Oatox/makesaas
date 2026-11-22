import { useState, type FormEvent } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Settings, Trash2 } from "lucide-react";
import { DEFAULT_SAAS_ICON, SAAS_NAME_MAX_LENGTH, type Saas, type SaasIcon } from "@shared/saas";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { saasErrorMessage, useSaas } from "@/hooks/use-saas";
import { cn } from "@/lib/utils";
import { getSaasIcon, SAAS_ICON_OPTIONS, toSaasIcon } from "./saas-icons";

// Same raised surfaces as the dropposting organization switcher.
const switcherSurfaceClassName =
  "rounded-lg border border-white/[0.07] bg-gradient-to-b from-[#1e1e1e] to-[#121212] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_8px_18px_-12px_rgba(0,0,0,0.72),0_2px_6px_-3px_rgba(0,0,0,0.55)]";

const switcherSurfaceInteractiveClassName =
  "transition-[background,border-color,box-shadow,transform] hover:border-white/[0.09] hover:from-[#222222] hover:to-[#151515] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_10px_20px_-12px_rgba(0,0,0,0.78),0_3px_8px_-4px_rgba(0,0,0,0.58)] active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04)] data-[state=open]:border-white/[0.09] data-[state=open]:from-[#222222] data-[state=open]:to-[#151515]";

const menuItemClassName =
  "flex h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm font-medium focus:bg-muted/40 focus:text-sidebar-foreground data-[highlighted]:bg-muted/40";

/** The SaaS icon in its orange tile (switcher trigger, list, dialogs). */
function SaasMark({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = getSaasIcon(icon);
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary", className)}>
      <Icon className="h-[60%] w-[60%]" strokeWidth={2} />
    </span>
  );
}

type SaasDialogState = { mode: "create" } | { mode: "edit"; saas: Saas } | null;

/** Creates a SaaS or edits one (name, icon, deletion). */
function SaasDialog({ state, onClose }: { state: SaasDialogState; onClose: () => void }) {
  const { saasList, createSaas, isCreating, updateSaas, isUpdating, deleteSaas, isDeleting } = useSaas();
  const { toast } = useToast();
  const editing = state?.mode === "edit" ? state.saas : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<SaasIcon>(editing ? toSaasIcon(editing.icon) : DEFAULT_SAAS_ICON);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSaving = isCreating || isUpdating;
  const isLastOne = saasList.length <= 1;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;

    try {
      if (editing) {
        await updateSaas({ id: editing.id, name: trimmed, icon });
        toast({ title: "SaaS mis à jour" });
      } else {
        await createSaas({ name: trimmed, icon });
        toast({ title: "SaaS créé", description: `${trimmed} est maintenant ton SaaS actif.` });
      }
      onClose();
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, editing ? "Modification impossible" : "Création impossible") });
    }
  };

  const remove = async () => {
    if (!editing) return;
    try {
      await deleteSaas(editing.id);
      toast({ title: "SaaS supprimé", description: `${editing.name} a été supprimé.` });
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Suppression impossible") });
    }
  };

  return (
    <>
      <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Réglages du SaaS" : "Nouveau SaaS"}</DialogTitle>
            <DialogDescription>
              {editing ? "Renomme ton SaaS ou change son icône." : "Chaque SaaS a son propre espace : passe de l'un à l'autre depuis la barre latérale."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="saas-name">Nom</Label>
              <Input
                id="saas-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Mon super SaaS"
                maxLength={SAAS_NAME_MAX_LENGTH}
                autoFocus
                data-testid="input-saas-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Icône</Label>
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Icône du SaaS">
                {SAAS_ICON_OPTIONS.map((option) => {
                  const selected = option.value === icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={option.label}
                      title={option.label}
                      onClick={() => setIcon(option.value)}
                      className={cn(
                        "flex h-12 items-center justify-center rounded-[10px] border transition-colors",
                        selected
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                      )}
                    >
                      <option.icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isLastOne}
                  title={isLastOne ? "Tu dois garder au moins un SaaS" : undefined}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 /> Supprimer
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                  Annuler
                </Button>
                <Button type="submit" disabled={!name.trim() || isSaving} data-testid="button-saas-submit">
                  {isSaving ? <Loader2 className="animate-spin" /> : editing ? <Check /> : <Plus />}
                  {editing ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {editing?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>Le SaaS et tout ce qui lui est rattaché seront supprimés définitivement.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Sidebar header: the active SaaS, the list to switch, and "Nouveau SaaS". */
export function SaasSwitcher({ isCollapsed }: { isCollapsed: boolean }) {
  const { saasList, currentSaas, isLoading, switchSaas, isSwitching } = useSaas();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<SaasDialogState>(null);

  const handleSwitch = async (saasId: string) => {
    if (saasId === currentSaas?.id) return;
    try {
      await switchSaas(saasId);
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Changement impossible") });
    }
  };

  if (isLoading) {
    return (
      <div className={cn(switcherSurfaceClassName, "flex items-center gap-2 px-2", isCollapsed ? "h-9 w-9 justify-center" : "h-14 w-full")}>
        <div className="h-7 w-7 animate-pulse rounded-md bg-sidebar-foreground/15" />
        {!isCollapsed && <div className="h-4 flex-1 animate-pulse rounded bg-sidebar-foreground/15" />}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isSwitching}>
          <button
            type="button"
            aria-label="Changer de SaaS"
            className={cn(
              switcherSurfaceClassName,
              switcherSurfaceInteractiveClassName,
              "flex items-center justify-between text-sm font-medium text-sidebar-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/35",
              isCollapsed ? "h-11 w-9 justify-center px-0" : "min-h-14 w-full px-3 py-2",
            )}
            data-testid="button-saas-switcher"
          >
            {isCollapsed ? (
              isSwitching ? <Loader2 className="h-5 w-5 animate-spin" /> : <SaasMark icon={currentSaas?.icon} className="h-7 w-7" />
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  {isSwitching ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </span>
                  ) : (
                    <SaasMark icon={currentSaas?.icon} className="h-8 w-8" />
                  )}
                  <div className="min-w-0 text-left">
                    <p className="truncate leading-tight">{currentSaas?.name ?? "Aucun SaaS"}</p>
                    <p className="truncate text-xs font-normal text-sidebar-foreground/60">{saasList.length} SaaS</p>
                  </div>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side={isCollapsed ? "right" : "bottom"}
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-60 rounded-md border-sidebar-border/80 bg-sidebar p-1 text-sidebar-foreground shadow-lg"
        >
          {saasList.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => handleSwitch(item.id)} className={menuItemClassName}>
              <Check className={cn("h-4 w-4 shrink-0", item.id === currentSaas?.id ? "opacity-100" : "opacity-0")} />
              <SaasMark icon={item.icon} className="h-6 w-6" />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <button
                type="button"
                aria-label={`Réglages de ${item.name}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-sidebar-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-muted-foreground/40"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDialog({ mode: "edit", saas: item });
                }}
              >
                <Settings className="h-4 w-4" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-sidebar-border/70" />
          <DropdownMenuItem onSelect={() => setDialog({ mode: "create" })} className={cn(menuItemClassName, "h-9 justify-center")} data-testid="button-saas-create">
            <Plus className="h-4 w-4" />
            Nouveau SaaS
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Keyed so each opening starts from the SaaS's current values. */}
      <SaasDialog key={dialog ? (dialog.mode === "edit" ? dialog.saas.id : "create") : "closed"} state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
