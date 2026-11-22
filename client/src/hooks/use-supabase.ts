import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, subDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api-client";
import { translateSupabaseError } from "@/lib/error-translator";
import { formatDayMonth } from "@/lib/format";
import { profileKeys, useAuth } from "./use-auth";
import { adminKeys } from "./use-admin-profiles";
import { toast } from "./use-toast";

/** Fields a user may change on their own profile (role and plan are server-only). */
type SelfProfileUpdate = { full_name?: string | null; avatar_url?: string | null };

/** Self-service profile update, straight to Supabase (allowed by RLS). The profile itself is read via useAuth. */
export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: SelfProfileUpdate) => {
      if (!user) throw new Error("Session expirée. Veuillez vous reconnecter.");
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(user?.id) });
      toast({ title: "Profil mis à jour", description: "Vos modifications ont été enregistrées." });
    },
    onError: (error) => {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la mise à jour") });
    },
  });
}

/** GDPR erasure of the signed-in account (auth user + cascade), done by the server. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiRequest<void>("/api/account", { method: "DELETE" }),
    onSuccess: async () => {
      toast({ title: "Compte supprimé", description: "Votre compte et vos données ont été définitivement supprimés." });
      // The auth user no longer exists: only drop the local session (SIGNED_OUT clears the cache and redirects).
      await supabase.auth.signOut({ scope: "local" });
    },
    onError: (error) => {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la suppression") });
    },
  });
}

export type AdminMetrics = { today: number; week: number; month: number; admins: number };

/**
 * Hook for fetching admin metrics (Admin only)
 */
export function useAdminMetrics() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.metrics,
    queryFn: async (): Promise<AdminMetrics> => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const countProfiles = () => supabase.from("profiles").select("id", { count: "exact", head: true });

      const results = await Promise.all([
        countProfiles().gte("created_at", today),
        countProfiles().gte("created_at", thisWeek),
        countProfiles().gte("created_at", thisMonth),
        countProfiles().eq("role", "admin"),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const [todayCount, weekCount, monthCount, adminCount] = results.map((result) => result.count ?? 0);
      return { today: todayCount, week: weekCount, month: monthCount, admins: adminCount };
    },
    enabled: isAdmin,
    refetchInterval: 1000 * 60, // Refresh every minute
  });
}

export type GrowthPoint = { date: string; count: number };

const GROWTH_DAYS = 30;

/**
 * Hook for fetching user growth data (Admin only)
 */
export function useUserGrowth() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.growth,
    queryFn: async (): Promise<GrowthPoint[]> => {
      const today = startOfDay(new Date());
      const { data, error } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", subDays(today, GROWTH_DAYS - 1).toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Signups per local day, then one point per day (missing days at 0) for Recharts.
      const dayKey = (date: Date) => format(date, "yyyy-MM-dd");
      const counts: Record<string, number> = {};
      for (const profile of data ?? []) {
        const key = dayKey(new Date(profile.created_at));
        counts[key] = (counts[key] ?? 0) + 1;
      }

      return Array.from({ length: GROWTH_DAYS }, (_, i) => {
        const day = subDays(today, GROWTH_DAYS - 1 - i);
        return { date: formatDayMonth(day), count: counts[dayKey(day)] ?? 0 };
      });
    },
    enabled: isAdmin,
  });
}
