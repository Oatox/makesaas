import { createClient } from "@supabase/supabase-js";

// Validation strictly on the client-side
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const hasSupabaseClientEnv = Boolean(supabaseUrl && supabasePublishableKey);

if (!supabaseUrl || !supabasePublishableKey) {
  if (import.meta.env.DEV) {
    console.error(
      "CRITICAL: Supabase environment variables are missing. Please check your .env or Replit Secrets."
    );
  }
}

// Singleton pattern for the Supabase client
export const supabase = createClient(supabaseUrl || "", supabasePublishableKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
