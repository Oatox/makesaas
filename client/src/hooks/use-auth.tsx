import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AUTH_CONFIG } from "@/config/auth";
import { syncSignupSource } from "@/lib/attribution";
import { grantsAccess, SUBSCRIPTION_SUMMARY_COLUMNS, type SubscriptionSummary } from "@shared/billing";
import { translateSupabaseError } from "@/lib/error-translator";

export type AuthProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  /** Active SaaS (see useSaas); null: none chosen yet, the oldest one is used. */
  current_saas_id: string | null;
  /** Row of public.subscriptions (null: never subscribed). Access is read with grantsAccess(status). */
  subscription: SubscriptionSummary | null;
};

export const profileKeys = {
  detail: (userId: string | undefined) => ["profile", userId] as const,
};

// The subscription is embedded (subscriptions.user_id references profiles.id, one row per user).
const PROFILE_COLUMNS = `id, email, full_name, avatar_url, role, current_saas_id, subscription:subscriptions(${SUBSCRIPTION_SUMMARY_COLUMNS})`;

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  /** The profile could not be loaded (network, server): access is unknown, do not treat the user as unsubscribed. */
  isProfileError: boolean;
  retryProfile: () => void;
  isAdmin: boolean;
  /** Subscription granting access (or admin): unlocks the app. Everyone else goes through the paywall. */
  hasAccess: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.access_token) {
        const { data, error } = await supabase.auth.getUser(session.access_token);

        if (error || !data.user) {
          await supabase.auth.signOut({ scope: "local" });
          setSession(null);
          setUser(null);
          setIsLoadingSession(false);
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      setIsLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoadingSession(false);

      if (event === "SIGNED_OUT") {
        queryClient.clear();
        window.location.href = AUTH_CONFIG.LOGIN_PATH;
      }

      if (event === "SIGNED_IN" && session) {
        syncSignupSource(session);
      }

      // Activity is recorded once per sign-in / page load, not on every token refresh.
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        supabase
          .from("profiles")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", session.user.id)
          .then(({ error }) => {
            if (error) console.error("Error updating last active:", error);
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const profileQuery = useQuery<AuthProfile | null>({
    queryKey: profileKeys.detail(user?.id),
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
      if (error) throw error;

      // The row is created by a trigger right after sign-up: until it exists, a user without subscription.
      return (
        (data as AuthProfile | null) ?? {
          id: user.id,
          email: user.email ?? null,
          full_name: null,
          avatar_url: null,
          role: "user",
          current_saas_id: null,
          subscription: null,
        }
      );
    },
    enabled: !!user,
    staleTime: 0, // Ensure we get fresh data
    retry: 2,
  });

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la déconnexion") });
    }
  }, []);

  const profile = profileQuery.data ?? null;
  const isLoading = isLoadingSession || (!!user && profileQuery.isLoading);
  const isProfileError = !!user && profileQuery.isError && !profile;
  const { refetch } = profileQuery;
  const retryProfile = useCallback(() => void refetch(), [refetch]);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      profile,
      isLoading,
      isProfileError,
      retryProfile,
      isAdmin: profile?.role === "admin",
      hasAccess: profile?.role === "admin" || grantsAccess(profile?.subscription?.status),
      signOut,
    }),
    [session, user, profile, isLoading, isProfileError, retryProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
