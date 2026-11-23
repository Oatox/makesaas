import { useState, type FormEvent } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { CreditCard, Loader2, Plus, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { TIKTOK_MAX_ACCOUNTS } from "@shared/acquisition";
import { SAAS_NAME_MAX_LENGTH, type Saas } from "@shared/saas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTikTokAccounts } from "@/hooks/use-acquisition";
import { useIsMobile } from "@/hooks/use-mobile";
import { saasErrorMessage, useSaas } from "@/hooks/use-saas";
import { SaasAvatar } from "./SaasAvatar";
import { SaasGeneralSettings } from "./SaasGeneralSettings";
import { SaasPaymentSettings } from "./SaasPaymentSettings";
import { SaasTikTokSettings } from "./SaasTikTokSettings";

/** The tabs of a SaaS's settings. */
export type SaasSettingsTab = "general" | "tiktok" | "payments";

export type SaasDialogState =
  | { mode: "create" }
  /** `tab`: the tab it opens on, "general" by default. */
  | { mode: "edit"; saas: Saas; tab?: SaasSettingsTab }
  | null;

/**
 * Creates a SaaS (it becomes the active one), or manages one: its name, its TikTok accounts, its
 * payment account, and its deletion. Render it with a `key` that changes on every opening, so it
 * starts from the SaaS's current values.
 */
export function SaasDialog({
  state,
  onClose,
  onCreated,
}: {
  state: SaasDialogState;
  onClose: () => void;
  /** Called once a SaaS is created, before the dialog closes. */
  onCreated?: (saas: Saas) => void;
}) {
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      {/* The settings lay out their own padding: a column of sections next to the content from md up. */}
      <DialogContent
        className={
          state?.mode === "edit"
            ? // Phones: one height for every section (no jump between tabs), the header and tabs stay put.
              "gap-0 p-0 max-md:h-[min(35rem,calc(100dvh-1rem))] max-md:overflow-hidden sm:max-w-lg sm:p-0 md:max-w-[720px] md:overflow-hidden"
            : "sm:max-w-md"
        }
      >
        {state?.mode === "edit" ? (
          <SaasSettings saas={state.saas} initialTab={state.tab ?? "general"} onClose={onClose} />
        ) : (
          <CreateSaasForm onClose={onClose} onCreated={onCreated} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateSaasForm({ onClose, onCreated }: { onClose: () => void; onCreated?: (saas: Saas) => void }) {
  const { createSaas, isCreating } = useSaas();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const trimmed = name.trim();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed || isCreating) return;
    try {
      const created = await createSaas({ name: trimmed });
      toast({ title: "SaaS créé", description: `${trimmed} est maintenant ton SaaS actif.` });
      onCreated?.(created);
      onClose();
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Création impossible") });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouveau SaaS</DialogTitle>
        <DialogDescription>
          Chaque SaaS a son propre espace et ses propres données. Tu passes de l'un à l'autre depuis la barre latérale.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-6">
        <div className="flex items-end gap-3">
          <SaasAvatar name={trimmed || "?"} className="size-11 rounded-[12px] text-base" />
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="saas-name">Nom</Label>
            <Input
              id="saas-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mon super SaaS"
              maxLength={SAAS_NAME_MAX_LENGTH}
              autoComplete="off"
              autoFocus
              data-testid="input-saas-name"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isCreating}>
            Annuler
          </Button>
          <Button type="submit" disabled={!trimmed || isCreating} data-testid="button-saas-submit">
            {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
            Créer le SaaS
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

// Section links, in the look of the app sidebar's links: muted at rest, a soft fill with white text
// and an orange icon once active. On phones, three equal segments in a recessed track (the look of
// the app's SegmentedControl); a column from md up.
const tabTriggerClass =
  "group flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-transparent px-1.5 text-[13px] font-medium text-muted-foreground transition-colors " +
  "hover:bg-white/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
  "md:h-10 md:flex-none md:justify-start md:gap-2.5 md:rounded-[10px] md:px-3 md:text-sm " +
  "data-[state=active]:border-white/[0.09] data-[state=active]:bg-white/[0.07] data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]";

const TABS: { value: SaasSettingsTab; label: string; icon: LucideIcon | typeof SiTiktok; title: string; description: string }[] = [
  {
    value: "general",
    label: "Général",
    icon: SlidersHorizontal,
    title: "Général",
    description: "Le nom et le logo du SaaS, tels qu'ils apparaissent dans la barre latérale.",
  },
  {
    value: "tiktok",
    label: "TikTok",
    icon: SiTiktok,
    title: "Comptes TikTok",
    description: `Les comptes suivis dans Acquisition, jusqu'à ${TIKTOK_MAX_ACCOUNTS} au total sur tous tes SaaS.`,
  },
  {
    value: "payments",
    label: "Paiements",
    icon: CreditCard,
    title: "Compte de paiement",
    description: "Le compte Stripe ou Whop dont le tableau de bord lit le MRR et les revenus de ce SaaS.",
  },
];

function SaasSettings({ saas: openedSaas, initialTab, onClose }: { saas: Saas; initialTab: SaasSettingsTab; onClose: () => void }) {
  const { saasList } = useSaas();
  // The SaaS as it is now (renamed from the "Général" tab), the one it was opened on otherwise.
  const saas = saasList.find((item) => item.id === openedSaas.id) ?? openedSaas;
  const [tab, setTab] = useState<SaasSettingsTab>(initialTab);
  // Kept here so a name being typed survives a change of tab.
  const [name, setName] = useState(saas.name);
  // Shared with the TikTok tab (same query): its count on the tab.
  const tiktokCount = useTikTokAccounts(saas.id).data?.length;
  // The tabs form a column from md up (arrow keys up and down), a row below.
  const isMobile = useIsMobile();

  return (
    <TabsPrimitive.Root
      value={tab}
      onValueChange={(value) => setTab(value as SaasSettingsTab)}
      orientation={isMobile ? "horizontal" : "vertical"}
      // A fixed height from md up, so the dialog does not jump from one section to the other.
      className="flex h-full min-h-0 min-w-0 flex-col md:h-[min(30rem,calc(100vh-2rem))] md:flex-row"
    >
      <div className="flex shrink-0 flex-col gap-3.5 border-b border-border/70 p-4 pb-3.5 sm:p-5 md:w-52 md:gap-5 md:border-b-0 md:border-r md:bg-background/40 md:p-3 md:pt-4">
        {/* Room on the right for the close button, which sits over this header on phones. */}
        <div className="flex min-w-0 items-center gap-3 pr-10 md:px-1.5 md:pr-1.5">
          <SaasAvatar name={saas.name} seed={saas.id} logoUrl={saas.logo_url} className="size-9 rounded-[10px] text-sm" />
          <div className="min-w-0">
            <DialogTitle className="truncate font-sans text-[15px] font-semibold tracking-normal">{saas.name}</DialogTitle>
            <DialogDescription className="text-xs">Réglages du SaaS</DialogDescription>
          </div>
        </div>

        <TabsPrimitive.List
          aria-label="Sections des réglages du SaaS"
          className="flex gap-0.5 rounded-[12px] border border-border bg-background/60 p-[3px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] md:flex-col md:gap-1 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
        >
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsPrimitive.Trigger key={value} value={value} className={tabTriggerClass} data-testid={`tab-saas-${value}`}>
              <Icon
                className="size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground/80 group-data-[state=active]:text-primary"
                aria-hidden
              />
              <span className="truncate">{label}</span>
              {value === "tiktok" && tiktokCount !== undefined && tiktokCount > 0 && (
                <span className="rounded-full bg-white/[0.07] px-1.5 text-[11px] font-semibold leading-[18px] tabular-nums text-muted-foreground md:ml-auto">
                  {tiktokCount}
                </span>
              )}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-5 md:p-7">
        {TABS.map(({ value, title, description }) => (
          <TabsPrimitive.Content key={value} value={value} className="space-y-5 focus-visible:outline-none md:space-y-6">
            {/* Room on the right for the close button from md up. On phones the tab already names
                the section: its description only. */}
            <header className="space-y-1 md:pr-10">
              <h3 className="font-display text-lg leading-tight max-md:sr-only">{title}</h3>
              <p className="text-[13px] text-muted-foreground md:text-sm">{description}</p>
            </header>
            {value === "general" && <SaasGeneralSettings saas={saas} name={name} onNameChange={setName} onDeleted={onClose} />}
            {value === "tiktok" && <SaasTikTokSettings saas={saas} />}
            {value === "payments" && <SaasPaymentSettings saas={saas} />}
          </TabsPrimitive.Content>
        ))}
      </div>
    </TabsPrimitive.Root>
  );
}
