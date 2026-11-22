import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

/**
 * Single server-side Supabase client using the secret key (bypasses RLS).
 * Null when the environment is not configured, so callers can answer a clean 500.
 */
function createSupabaseAdmin(): SupabaseClient | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const missingEnvVars: string[] = [];

  if (!supabaseUrl) missingEnvVars.push("VITE_SUPABASE_URL (or SUPABASE_URL)");
  if (!secretKey) missingEnvVars.push("SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    logger.error({ missingEnvVars }, "Supabase admin client is not configured. Check Replit Secrets / .env");
    return null;
  }

  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin = createSupabaseAdmin();
