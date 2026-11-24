import { z } from "zod";

/**
 * A "SaaS": the product a member builds. One owner each (no members); the member switches between
 * them from the sidebar (SaasSwitcher), like organizations, and product data belongs to a SaaS
 * (saas_id). Table public.saas, section 8 of supabase_setup.sql.
 */

/** Mirrored by saas_name_check in supabase_setup.sql. */
export const SAAS_NAME_MAX_LENGTH = 60;

/** Mirrored by enforce_saas_limit in supabase_setup.sql. */
export const SAAS_MAX_PER_USER = 20;

/** Message of the exception raised by enforce_saas_limit once SAAS_MAX_PER_USER is reached. */
export const SAAS_LIMIT_ERROR = "saas_limit";

/**
 * Message of the exception raised by enforce_saas_from_idea: an idea gives the member's first SaaS
 * only, so keeping one is refused once they have a SaaS (the project chosen on /lancement is locked).
 */
export const SAAS_IDEA_TAKEN_ERROR = "saas_idea_taken";

/** Mirrored by saas_description_check and saas_audience_check in supabase_setup.sql. */
export const SAAS_DESCRIPTION_MAX_LENGTH = 200;
export const SAAS_AUDIENCE_MAX_LENGTH = 200;

/** Row of public.saas as the client reads it. */
export type Saas = {
  id: string;
  name: string;
  /** Public URL of its logo in the R2 bucket (shared/storage.ts), written by the server; null: initials. */
  logo_url: string | null;
  /** What it does, in one sentence; null until the member says it. */
  description: string | null;
  /** The customer it targets; null until the member says it. */
  audience: string | null;
  /** The idea it was created from on /lancement (shared/ideas.ts); null when created by its name only. */
  idea_id: string | null;
  /**
   * Address of its app, written by the server (PUT /api/roadmap/app-url, from its roadmap task or its
   * settings); null until the member gives it.
   */
  app_url: string | null;
  created_at: string;
  updated_at: string;
};

export const SAAS_COLUMNS = "id, name, logo_url, description, audience, idea_id, app_url, created_at, updated_at";

export const saasInputSchema = z.object({
  name: z.string().trim().min(1, "Donne un nom à ton SaaS").max(SAAS_NAME_MAX_LENGTH),
});
export type SaasInput = z.infer<typeof saasInputSchema>;

/** A new SaaS: its name, and when it comes from an idea, the idea and what it says. */
export type SaasCreate = SaasInput & Partial<Pick<Saas, "description" | "audience" | "idea_id">>;

/** A logo picked in the browser, before it is resized there. */
export const SAAS_LOGO_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
/** The browser resizes the logo to fit this square (px) before sending it. */
export const SAAS_LOGO_SIZE = 256;
/** The resized logo the server accepts. */
export const SAAS_LOGO_MAX_BYTES = 1024 * 1024;

export const saasApi = {
  /** PUT an image (raw body, its Content-Type) → the Saas row with its new logo_url; DELETE → logo_url null. */
  logo: (saasId: string) => `/api/saas/${saasId}/logo`,
  /** DELETE, once the SaaS is deleted (straight from Supabase) → 204: removes its files (logo, carousel images). */
  files: (saasId: string) => `/api/saas/${saasId}/files`,
} as const;
