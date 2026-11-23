import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile, SignupSource } from "@shared/schema";
import { ACCESS_STATUSES, type SubscriptionSummary } from "@shared/billing";
import { profileKeys, useAuth } from "./use-auth";
import { toast } from "./use-toast";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api-client";
import { translateSupabaseError } from "@/lib/error-translator";

/** Every admin query lives under ["admin"]: a user change invalidates them all at once. */
export const adminKeys = {
  all: ["admin"] as const,
  metrics: ["admin", "metrics"] as const,
  growth: ["admin", "growth"] as const,
  profilesPage: (params: UsePaginatedProfilesParams) => ["admin", "profiles", params] as const,
  userDetails: (userId: string | undefined) => ["admin", "user-details", userId] as const,
};

export type AdminUserDetailsResponse = {
  profile: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    role: "user" | "admin";
    subscription: SubscriptionSummary | null;
    createdAt: string | null;
    lastActiveAt: string | null;
    lastSignInAt: string | null;
    signupSource: SignupSource | null;
  };
  sessions: {
    id: string;
    device: string;
    ipAddress: string | null;
    status: "active" | "expired";
    createdAt: string | null;
    expiresAt: string | null;
  }[];
  sessionsUnavailable: boolean;
  providers: {
    id: string;
    provider: string;
    status: "connected";
    connectedAt: string | null;
    lastSignInAt: string | null;
  }[];
};

/** Columns shown in the users table. */
const PROFILE_ROW_COLUMNS = "id, email, full_name, avatar_url, role, created_at";
/** Embedded subscription (one row per user); "!inner" keeps only users having one. */
const subscriptionEmbed = (inner: boolean) => `subscription:subscriptions${inner ? "!inner" : ""}(status)`;

export type AdminProfileRow = Pick<Profile, "id" | "email" | "full_name" | "avatar_url" | "role"> & {
  created_at: string | null;
  subscription: Pick<SubscriptionSummary, "status"> | null;
};

export type PaginatedProfilesResponse = {
  profiles: AdminProfileRow[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

type UsePaginatedProfilesParams = {
  page: number;
  pageSize: number;
  searchQuery: string;
  roleFilter: string;
};

export function usePaginatedProfiles(params: UsePaginatedProfilesParams) {
  const { isAdmin } = useAuth();
  const { page, pageSize, searchQuery, roleFilter } = params;

  return useQuery<PaginatedProfilesResponse>({
    queryKey: adminKeys.profilesPage(params),
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const normalizedSearch = searchQuery.trim().replace(/[^\w@.\-\s]/g, "");

      const subscribersOnly = roleFilter === "subscriber";
      let query = supabase
        .from("profiles")
        .select(`${PROFILE_ROW_COLUMNS}, ${subscriptionEmbed(subscribersOnly)}`, { count: "exact" })
        .order("created_at", { ascending: false });

      if (subscribersOnly) {
        query = query.in("subscription.status", [...ACCESS_STATUSES]);
      } else if (roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }

      if (normalizedSearch) {
        query = query.or(`email.ilike.%${normalizedSearch}%,full_name.ilike.%${normalizedSearch}%`);
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      const total = count ?? 0;
      return {
        profiles: (data ?? []) as unknown as AdminProfileRow[],
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        page,
        pageSize,
      };
    },
    enabled: isAdmin,
    placeholderData: keepPreviousData,
  });
}

export function useAdminUserDetails(userId?: string) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.userDetails(userId),
    queryFn: ({ signal }) => apiRequest<AdminUserDetailsResponse>(`/api/admin/users/${userId}/details`, { signal }),
    enabled: isAdmin && !!userId,
  });
}

type AdminUserUpdate = { role?: "user" | "admin"; subscribed?: boolean };

const roleLabel = (role: "user" | "admin") => (role === "admin" ? "Administrateur" : "Utilisateur");

/** Role and/or subscription change, done by the server (profiles are read-only for the client). */
export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: AdminUserUpdate }) =>
      apiRequest<void>(`/api/admin/users/${id}`, { method: "PATCH", body: updates }),
    onSuccess: (_, { id, updates }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      // The admin may have changed their own subscription.
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(id) });
      toast(
        updates.role
          ? { title: "Rôle mis à jour", description: `L'utilisateur est maintenant ${roleLabel(updates.role)}.` }
          : updates.subscribed
            ? { title: "Abonnement offert", description: "L'utilisateur a maintenant accès à l'application." }
            : { title: "Abonnement retiré", description: "L'utilisateur n'a plus accès à l'application." },
      );
    },
    onError: (error) => {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la mise à jour") });
    },
  });
}

/** Deletes the auth user (the profile follows by cascade). */
export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast({ title: "Utilisateur supprimé", description: "L'utilisateur a été retiré avec succès." });
    },
    onError: (error) => {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la suppression") });
    },
  });
}

export function useRevokeAdminSession(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest<void>(`/api/admin/users/${userId}/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetails(userId) });
      toast({ title: "Session supprimée", description: "La session a été révoquée." });
    },
    onError: (error) => {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la suppression") });
    },
  });
}

export function useRevokeAllAdminSessions(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest<void>(`/api/admin/users/${userId}/sessions/revoke-all`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetails(userId) });
      toast({ title: "Sessions révoquées", description: "Toutes les sessions ont été supprimées." });
    },
    onError: (error) => {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la révocation") });
    },
  });
}
