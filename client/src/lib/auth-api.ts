import { getSignupSource } from "@/lib/attribution";
import { hasSupabaseClientEnv, supabase } from "@/lib/supabase";

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Creates the account on the server (with its signup source), then opens the session. */
export async function registerWithEmail(email: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, signup_source: getSignupSource() }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(typeof payload?.message === "string" ? payload.message : "L'inscription a échoué, réessayez.");
  }

  await signInWithEmail(email, password);
}

/** Leaves for Google; the browser comes back to `redirectPath` signed in. */
export async function signInWithGoogle(redirectPath: string): Promise<void> {
  if (!hasSupabaseClientEnv) {
    if (import.meta.env.DEV) {
      console.error("Supabase client env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.");
    }
    throw new Error("La connexion avec Google est momentanément indisponible. Réessayez plus tard.");
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${redirectPath}` },
  });
  if (error) throw error;
}
