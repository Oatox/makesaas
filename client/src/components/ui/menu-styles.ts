// Shared look of the floating menus (DropdownMenu, Select), so every menu of the app looks the same.
// Usages only set their width and placement; a red action takes `variant="destructive"`.
//
// Rows follow the sidebar links (layout/nav-styles.ts): muted at rest, white on a light wash when
// highlighted, icons dimmer than the text. Tailwind 3 applies stacked variants right to left:
// [&>svg]:data-[highlighted]: styles the icon of the highlighted row.

/** The panel: `.menu-3d` surface (index.css), rounded, with the open/close animation. */
export const menuPanelClass =
  "menu-3d z-50 min-w-[8rem] rounded-[14px] p-1.5 text-popover-foreground " +
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 " +
  "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

/** A row: 44px tall on touch screens, 36px from `sm`. */
export const menuItemClass =
  "relative flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-medium " +
  "text-foreground/80 outline-none transition-colors duration-100 sm:min-h-9 sm:py-1.5 " +
  "[&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-foreground/50 [&>svg]:transition-colors " +
  "data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-foreground [&>svg]:data-[highlighted]:text-foreground/80 " +
  "data-[state=open]:bg-white/[0.08] data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/** Red row for an action that removes something (Supprimer, Retirer, Déconnexion). */
export const menuItemDestructiveClass =
  "text-destructive [&>svg]:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive " +
  "[&>svg]:data-[highlighted]:text-destructive";

/** Rows with a check or dot on their left (checkbox, radio, select items): room for it. */
export const menuItemIndicatorPadding = "pl-8";

/** Where that check or dot sits, in orange like the active sidebar icon. */
export const menuIndicatorClass = "absolute left-2.5 flex size-4 items-center justify-center text-primary";

export const menuLabelClass = "px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground";

export const menuSeparatorClass = "-mx-1.5 my-1.5 h-px bg-border/70";
