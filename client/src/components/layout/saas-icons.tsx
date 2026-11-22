import { BarChart3, Bot, Boxes, Globe, Rocket, Sparkles, Store, Zap, type LucideIcon } from "lucide-react";
import { DEFAULT_SAAS_ICON, type SaasIcon } from "@shared/saas";

/** Icons a SaaS can pick (keys stored in saas.icon), in picker order. */
export const SAAS_ICON_OPTIONS: { value: SaasIcon; label: string; icon: LucideIcon }[] = [
  { value: "rocket", label: "Fusée", icon: Rocket },
  { value: "sparkles", label: "IA", icon: Sparkles },
  { value: "zap", label: "Éclair", icon: Zap },
  { value: "boxes", label: "Produits", icon: Boxes },
  { value: "globe", label: "Web", icon: Globe },
  { value: "store", label: "Boutique", icon: Store },
  { value: "bot", label: "Bot", icon: Bot },
  { value: "chart", label: "Analytics", icon: BarChart3 },
];

export function getSaasIcon(icon?: string | null): LucideIcon {
  return (
    SAAS_ICON_OPTIONS.find((option) => option.value === icon)?.icon ??
    SAAS_ICON_OPTIONS.find((option) => option.value === DEFAULT_SAAS_ICON)!.icon
  );
}

/** Whether a stored icon key is one of the known ones (unknown keys are shown as the default). */
export function toSaasIcon(icon?: string | null): SaasIcon {
  return SAAS_ICON_OPTIONS.find((option) => option.value === icon)?.value ?? DEFAULT_SAAS_ICON;
}
