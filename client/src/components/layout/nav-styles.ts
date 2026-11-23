// Shared look of the sidebar links (AppSidebar and the categories it renders, e.g. the discussions).

// Links listed flat under their category label: muted at rest, a light wash on hover. The active one
// gets a soft fill with a thin border and a top highlight, white text and an orange icon. Collapsed to
// icons, each link is a 40px square with the same active style. Tailwind 3 applies stacked variants
// right to left:
// [&>svg]:hover: styles the icon when the link is hovered.
export const navLinkClass =
  "h-11 gap-3 rounded-[10px] border border-transparent px-3 text-[15px] font-medium text-sidebar-foreground/65 transition-colors duration-150 " +
  "[&>svg]:size-5 [&>svg]:text-sidebar-foreground/45 [&>svg]:transition-colors " +
  "hover:bg-white/[0.045] hover:text-sidebar-foreground [&>svg]:hover:text-sidebar-foreground/80 " +
  "data-[active=true]:border-white/[0.09] data-[active=true]:bg-white/[0.07] data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground " +
  "data-[active=true]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] [&>svg]:data-[active=true]:text-primary hover:data-[active=true]:bg-white/[0.07] " +
  "group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center";

// Sub-page links: smaller rows hanging from a thin line under the parent's icon, same muted → white
// states as the main links (and the same muted → orange icon).
export const navSubLinkClass =
  "h-9 gap-2.5 rounded-[8px] px-2.5 text-sm font-medium text-sidebar-foreground/60 transition-colors duration-150 " +
  "[&>svg]:size-4 [&>svg]:text-sidebar-foreground/45 [&>svg]:transition-colors " +
  "hover:bg-white/[0.045] hover:text-sidebar-foreground [&>svg]:hover:text-sidebar-foreground/80 " +
  "data-[active=true]:bg-white/[0.07] data-[active=true]:text-sidebar-foreground hover:data-[active=true]:bg-white/[0.07] " +
  "[&>svg]:data-[active=true]:text-primary";
