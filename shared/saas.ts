import { z } from "zod";

/**
 * A "SaaS": the product a user builds. One owner each (no members); the user switches between
 * them from the sidebar, like organizations. Table public.saas (supabase_setup.sql, sections 2 and 8).
 */

export const SAAS_NAME_MAX_LENGTH = 80;

/** Icon keys stored in saas.icon (drawn by client/src/components/layout/saas-icons.tsx). */
export const SAAS_ICONS = ["rocket", "sparkles", "zap", "boxes", "globe", "store", "bot", "chart"] as const;
export type SaasIcon = (typeof SAAS_ICONS)[number];
export const DEFAULT_SAAS_ICON: SaasIcon = "rocket";

/** Name of the SaaS created at signup; mirrored by handle_new_user in supabase_setup.sql. */
export const DEFAULT_SAAS_NAME = "Mon SaaS";

/** Error raised by the prevent_last_saas_delete trigger (message of the Postgres exception). */
export const SAAS_LAST_ONE_ERROR = "saas_last_one";

/** Row of public.saas as the client reads it. */
export type Saas = {
  id: string;
  name: string;
  icon: string;
  created_at: string;
  updated_at: string;
};

export const SAAS_COLUMNS = "id, name, icon, created_at, updated_at";

export const saasInputSchema = z.object({
  name: z.string().trim().min(1, "Donne un nom à ton SaaS").max(SAAS_NAME_MAX_LENGTH),
  icon: z.enum(SAAS_ICONS),
});
export type SaasInput = z.infer<typeof saasInputSchema>;
