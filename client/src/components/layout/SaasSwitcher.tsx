import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronsUpDown, Lightbulb, Loader2, RotateCw, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SaasAvatar } from "@/components/saas/SaasAvatar";
import { SaasDialog, type SaasDialogState } from "@/components/saas/SaasDialog";
import { AUTH_CONFIG } from "@/config/auth";
import { useToast } from "@/hooks/use-toast";
import { saasErrorMessage, useSaas } from "@/hooks/use-saas";
import { cn } from "@/lib/utils";

// Same fill as the active link of AppSidebar (navLinkClass): soft white wash, thin border, top
// highlight. A little lighter on hover and while open, pressed in on click.
const surfaceClass =
  "rounded-[10px] border border-white/[0.09] bg-white/[0.07] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]";

const surfaceInteractiveClass =
  "transition-[background,border-color,transform] duration-150 " +
  "hover:border-white/[0.11] hover:bg-white/[0.09] active:translate-y-px " +
  "data-[state=open]:border-white/[0.11] data-[state=open]:bg-white/[0.09]";

const triggerClass = cn(
  surfaceClass,
  surfaceInteractiveClass,
  "flex items-center justify-between text-left text-sm font-medium text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
);

// Collapsed to icons: no card, the SaaS's tile alone, ringed on hover and while its menu is open.
const collapsedClass =
  "flex size-8 items-center justify-center rounded-[9px] outline-none ring-offset-2 ring-offset-sidebar " +
  "transition-[box-shadow,transform] duration-150 hover:ring-2 hover:ring-white/15 active:scale-95 " +
  "data-[state=open]:ring-2 data-[state=open]:ring-white/25 focus-visible:ring-2 focus-visible:ring-sidebar-ring";

// Expanded: a full-width card.
const triggerClassFor = (isCollapsed: boolean) =>
  isCollapsed ? collapsedClass : cn(triggerClass, "min-h-14 w-full px-3.5 py-2");

// Menu rows keep the shared look (components/ui/menu-styles.ts); only a tighter left edge for the
// SaaS avatars, and a group so a row can reveal its settings button.
const itemClass = "group/saas-item gap-3 pl-1.5 pr-1.5";

/**
 * Sidebar header: the active SaaS, the menu to switch to another one, and the settings of each SaaS.
 * For now the menu creates none: a SaaS comes from Gus's ideas (/lancement). Without any SaaS yet, a
 * card leading there.
 */
export function SaasSwitcher({ isCollapsed }: { isCollapsed: boolean }) {
  const { saasList, currentSaas, isLoading, isError, retry, switchSaas, isSwitching } = useSaas();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialog, setDialog] = useState<SaasDialogState>(null);
  // Bumped on every opening so the dialog starts from fresh values (see SaasDialog).
  const [dialogKey, setDialogKey] = useState(0);
  const openDialog = (state: Exclude<SaasDialogState, null>) => {
    setDialogKey((key) => key + 1);
    setDialog(state);
  };

  const handleSwitch = async (saasId: string) => {
    if (saasId === currentSaas?.id) return;
    try {
      await switchSaas(saasId);
    } catch (error) {
      toast({ variant: "destructive", ...saasErrorMessage(error, "Changement impossible") });
    }
  };

  const dialogElement = <SaasDialog key={dialogKey} state={dialog} onClose={() => setDialog(null)} />;

  if (isLoading) {
    if (isCollapsed) return <div className="size-8 animate-pulse rounded-[9px] bg-sidebar-foreground/15" />;
    return (
      <div className={cn(surfaceClass, "flex min-h-14 w-full items-center gap-3 px-3.5")}>
        <div className="size-7 shrink-0 animate-pulse rounded-md bg-sidebar-foreground/15" />
        <div className="h-4 flex-1 animate-pulse rounded bg-sidebar-foreground/15" />
      </div>
    );
  }

  // No SaaS yet (or the list failed to load): the same card, to retry, or to choose an idea with Gus
  // (/lancement): a first project always comes from one of his ideas, never from a blank form.
  if (isError || !currentSaas) {
    const Icon = isError ? RotateCw : Lightbulb;
    const title = isError ? "SaaS indisponibles" : "Choisir mon idée";
    const subtitle = isError ? "Réessayer" : "Avec Gus, pour créer ton projet";
    return (
      <>
        <button
          type="button"
          onClick={isError ? retry : () => navigate(AUTH_CONFIG.LAUNCH_PATH)}
          aria-label={isError ? "Recharger tes SaaS" : "Choisir mon idée avec Gus"}
          className={cn(
            triggerClassFor(isCollapsed),
            // An empty tile, waiting for the SaaS.
            isCollapsed && "border border-dashed border-white/20 text-sidebar-foreground/70 hover:border-white/35 hover:text-white",
          )}
          data-testid="button-saas-create-first"
        >
          {isCollapsed ? (
            <Icon className="size-4 shrink-0" />
          ) : (
            <span className="flex min-w-0 items-center gap-3">
              <Icon className="size-5 shrink-0 text-white" />
              <span className="min-w-0">
                <span className="block truncate leading-tight">{title}</span>
                <span className="block truncate text-xs font-normal text-sidebar-foreground/60">{subtitle}</span>
              </span>
            </span>
          )}
        </button>
        {dialogElement}
      </>
    );
  }

  const mark = isSwitching ? (
    <Loader2 className="size-5 shrink-0 animate-spin text-white" />
  ) : (
    <SaasAvatar
      name={currentSaas.name}
      seed={currentSaas.id}
      logoUrl={currentSaas.logo_url}
      className={isCollapsed ? "size-8 rounded-[9px] text-xs" : "size-7 rounded-md text-xs"}
    />
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isSwitching}>
          <button
            type="button"
            aria-label={`SaaS actif : ${currentSaas.name}. Changer de SaaS`}
            title={isCollapsed ? currentSaas.name : undefined}
            className={triggerClassFor(isCollapsed)}
            data-testid="button-saas-switcher"
          >
            {isCollapsed ? (
              mark
            ) : (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  {mark}
                  <span className="min-w-0 truncate leading-tight">{currentSaas.name}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        {/* Like the user menu of AppSidebar: the trigger's width when expanded. */}
        <DropdownMenuContent
          align={isCollapsed ? "start" : "center"}
          side={isCollapsed ? "right" : "bottom"}
          className={isCollapsed ? "w-60" : "w-[--radix-dropdown-menu-trigger-width] min-w-0"}
        >
          <div className="max-h-[min(22rem,60vh)] space-y-0.5 overflow-y-auto">
            {saasList.map((item) => {
              const active = item.id === currentSaas.id;
              return (
                <DropdownMenuItem
                  key={item.id}
                  // Another SaaS: switch to it. The active one: open its settings (nothing to switch).
                  onSelect={() => (active ? openDialog({ mode: "edit", saas: item }) : void handleSwitch(item.id))}
                  // The active SaaS is the one shown on the trigger: brighter text, no other mark.
                  className={cn(itemClass, active && "text-foreground")}
                  aria-current={active ? "true" : undefined}
                  data-testid={`saas-item-${item.id}`}
                >
                  <SaasAvatar name={item.name} seed={item.id} logoUrl={item.logo_url} className="size-7 rounded-md text-xs" />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <button
                    type="button"
                    aria-label={`Réglages de ${item.name}`}
                    title="Réglages"
                    className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-[10px] text-sidebar-foreground/55 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-sidebar-foreground focus:outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-sidebar-ring group-hover/saas-item:opacity-100 group-data-[highlighted]/saas-item:opacity-100 [@media(hover:none)]:opacity-100"
                    // Opens the settings instead of switching to this SaaS: the menu item selects on
                    // pointerup when it saw no pointerdown, and on Enter/Space, so none of them may
                    // reach it.
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDialog({ mode: "edit", saas: item });
                    }}
                  >
                    <Settings className="!size-[18px]" />
                  </button>
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogElement}
    </>
  );
}
