import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, ImageUp, Loader2, Trash2, X } from "lucide-react";
import { SAAS_NAME_MAX_LENGTH, type Saas } from "@shared/saas";
import { IMAGE_TYPES, IMAGE_TYPES_LABEL } from "@shared/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { saasErrorMessage, useSaas, useSaasLogo } from "@/hooks/use-saas";
import { ConfirmDialog } from "./ConfirmDialog";
import { SaasAvatar } from "./SaasAvatar";

type SaasGeneralSettingsProps = {
  saas: Saas;
  /** The name being typed: kept by the dialog, so it survives a change of tab. */
  name: string;
  onNameChange: (name: string) => void;
  /** Once the SaaS is deleted. */
  onDeleted: () => void;
};

/** "Général" tab of the SaaS settings: its logo, rename it, or delete it with everything it holds. */
export function SaasGeneralSettings({ saas, name, onNameChange, onDeleted }: SaasGeneralSettingsProps) {
  const { updateSaas, isUpdating, deleteSaas, isDeleting } = useSaas();
  const { uploadLogo, isUploading, removeLogo, isRemoving } = useSaasLogo();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const isLogoBusy = isUploading || isRemoving;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trimmed = name.trim();
  const isDirty = trimmed !== saas.name;
  const canSave = isDirty && !!trimmed && !isUpdating;

  const rename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    try {
      await updateSaas({ id: saas.id, name: trimmed });
      onNameChange(trimmed);
      toast({ title: "SaaS renommé", description: `Il s'appelle maintenant ${trimmed}.` });
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Modification impossible") });
    }
  };

  const pickLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // The same file can be picked again.
    if (!file) return;
    try {
      await uploadLogo({ saasId: saas.id, file });
      toast({ title: "Logo enregistré" });
    } catch (error) {
      toast({ variant: "destructive", title: "Logo non enregistré", description: (error as Error).message });
    }
  };

  const clearLogo = async () => {
    try {
      await removeLogo(saas.id);
      toast({ title: "Logo retiré", description: "Les initiales du SaaS le remplacent." });
    } catch (error) {
      toast({ variant: "destructive", title: "Logo non retiré", description: (error as Error).message });
    }
  };

  const remove = async () => {
    try {
      await deleteSaas(saas.id);
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Suppression impossible") });
      throw error;
    }
    toast({ title: "SaaS supprimé", description: `${saas.name} a été supprimé.` });
    onDeleted();
  };

  return (
    <div className="space-y-8">
      {/* The logo on the name's line: clicking it imports a new one (no separate button). */}
      <form onSubmit={rename} className="space-y-2">
        <Label htmlFor="saas-name">Nom</Label>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={isLogoBusy}
              aria-label={saas.logo_url ? "Changer le logo" : "Importer un logo"}
              title={`${saas.logo_url ? "Changer le logo" : "Importer un logo"} (${IMAGE_TYPES_LABEL}, carré de préférence)`}
              className="group/logo relative block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              data-testid="button-saas-logo-upload"
            >
              <SaasAvatar
                name={trimmed || saas.name}
                seed={saas.id}
                logoUrl={saas.logo_url}
                className="size-11 rounded-[10px] text-base md:size-10"
              />
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/60 text-white transition-opacity",
                  isLogoBusy ? "opacity-100" : "opacity-0 group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100",
                )}
              >
                {isLogoBusy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
              </span>
            </button>
            {saas.logo_url && !isLogoBusy && (
              <button
                type="button"
                onClick={clearLogo}
                aria-label="Retirer le logo"
                title="Retirer le logo"
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                data-testid="button-saas-logo-remove"
              >
                <X className="size-3" />
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={pickLogo}
              data-testid="input-saas-logo"
            />
          </div>
          <Input
            id="saas-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Mon super SaaS"
            maxLength={SAAS_NAME_MAX_LENGTH}
            autoComplete="off"
            aria-invalid={!trimmed}
            data-testid="input-saas-name"
          />
          {/* Only once the name changed: no greyed-out button sitting there the rest of the time. */}
          {isDirty && (
            <Button
              type="submit"
              disabled={!canSave}
              aria-label="Enregistrer"
              className="shrink-0 animate-in fade-in-0 zoom-in-95 duration-150 max-sm:px-3"
              data-testid="button-saas-submit"
            >
              {isUpdating ? <Loader2 className="animate-spin" /> : <Check />}
              <span className="hidden sm:inline">Enregistrer</span>
            </Button>
          )}
        </div>
        {!trimmed && <p className="text-xs text-destructive">Le nom ne peut pas être vide.</p>}
      </form>

      <section className="flex flex-col items-start gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:gap-6 md:pt-6">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="font-sans text-sm font-medium tracking-normal">Supprimer ce SaaS</h4>
          <p className="text-sm text-muted-foreground">
            Ses comptes TikTok, son compte de paiement, ses discussions et ses carrousels sont supprimés avec lui.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive sm:min-h-9 sm:px-4"
          onClick={() => setConfirmDelete(true)}
          data-testid="button-saas-delete"
        >
          <Trash2 /> Supprimer
        </Button>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer ${saas.name} ?`}
        description="Le SaaS et toutes ses données (comptes TikTok suivis, compte de paiement connecté, discussions, carrousels) seront supprimés définitivement. Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={remove}
        isPending={isDeleting}
        testId="button-saas-delete-confirm"
      />
    </div>
  );
}
