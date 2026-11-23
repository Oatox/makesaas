import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  revenueApi,
  type ConnectRevenueBody,
  type RevenueConnection,
  type RevenueDashboard,
  type RevenueSaasParams,
} from "@shared/revenue";
import { apiRequest } from "@/lib/api-client";
import { translateSupabaseError } from "@/lib/error-translator";
import { supabase } from "@/lib/supabase";
import { toast } from "./use-toast";

export const revenueKeys = {
  dashboard: (saasId: string | undefined) => ["revenue", "dashboard", saasId] as const,
};

/** Polled while the server syncs accounts in the background. */
const SYNC_POLL_MS = 3_000;

/** The SaaS's connected accounts and their combined figures (stale accounts are re-synced by the server). */
export function useRevenueDashboard(saasId: string | undefined) {
  return useQuery<RevenueDashboard>({
    queryKey: revenueKeys.dashboard(saasId),
    queryFn: ({ signal }) => {
      const query: RevenueSaasParams = { saasId: saasId! };
      return apiRequest<RevenueDashboard>(revenueApi.dashboard.path, { query, signal });
    },
    enabled: !!saasId,
    refetchInterval: (query) => (query.state.data?.syncing.length ? SYNC_POLL_MS : false),
    staleTime: 60_000,
  });
}

/** Checks the key, imports the account into the SaaS (a few seconds), then reloads its dashboard. */
export function useConnectRevenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ConnectRevenueBody) =>
      apiRequest<RevenueConnection>(revenueApi.connect.path, { method: "POST", body }),
    onSuccess: (_connection, body) => queryClient.invalidateQueries({ queryKey: revenueKeys.dashboard(body.saasId) }),
  });
}

/** Re-syncs every account of the SaaS now. */
export function useRefreshRevenue(saasId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const body: RevenueSaasParams = { saasId: saasId! };
      return apiRequest<RevenueDashboard>(revenueApi.refresh.path, { method: "POST", body });
    },
    onSuccess: (dashboard) => queryClient.setQueryData(revenueKeys.dashboard(saasId), dashboard),
    onError: (error) => toast({ variant: "destructive", title: "Actualisation impossible", description: error.message }),
  });
}

/** Removes a connected account of the SaaS (and its stored key), straight to Supabase (allowed by RLS). */
export function useRemoveRevenueConnection(saasId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revenue_connections").delete().eq("id", id).eq("saas_id", saasId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: revenueKeys.dashboard(saasId) });
      toast({ title: "Compte retiré", description: "Sa clé a été supprimée." });
    },
    onError: (error) => toast({ variant: "destructive", ...translateSupabaseError(error, "Échec de la suppression") }),
  });
}
