import { useEffect, useRef } from "react";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  acquisitionApi,
  syncedToday,
  type AddTikTokAccountRequest,
  type CheckFirstVideoRequest,
} from "@shared/acquisition";
import type { TikTokAccount, TikTokAccountStat, TikTokVideo } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api-client";
import { translateSupabaseError } from "@/lib/error-translator";
import { useCurrentSaasId } from "./use-saas";
import { toast } from "./use-toast";

// Every query is per SaaS: switching SaaS (sidebar) loads the other SaaS's accounts.
export const acquisitionKeys = {
  all: ["acquisition"] as const,
  accounts: (saasId: string | undefined) => ["acquisition", "accounts", saasId] as const,
  videos: (saasId: string | undefined) => ["acquisition", "videos", saasId] as const,
  stats: (saasId: string | undefined) => ["acquisition", "stats", saasId] as const,
};

const SYNC_MUTATION_KEY = ["acquisition", "sync"] as const;

/** Days of daily snapshots loaded for the evolution charts. */
export const STATS_HISTORY_DAYS = 90;

/**
 * TikTok accounts of the active SaaS, oldest first (read straight from Supabase, RLS). `forSaasId`
 * reads another SaaS of the member instead (its settings dialog).
 */
export function useTikTokAccounts(forSaasId?: string) {
  const currentSaasId = useCurrentSaasId();
  const saasId = forSaasId ?? currentSaasId;
  return useQuery({
    queryKey: acquisitionKeys.accounts(saasId),
    queryFn: async (): Promise<TikTokAccount[]> => {
      const { data, error } = await supabase.from("tiktok_accounts").select("*").eq("saas_id", saasId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!saasId,
  });
}

/** Known videos of the active SaaS's accounts, newest first. */
export function useTikTokVideos() {
  const saasId = useCurrentSaasId();
  return useQuery({
    queryKey: acquisitionKeys.videos(saasId),
    queryFn: async (): Promise<TikTokVideo[]> => {
      const { data, error } = await supabase
        .from("tiktok_videos")
        .select("*")
        .eq("saas_id", saasId!)
        .order("posted_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    enabled: !!saasId,
  });
}

/** Daily snapshots of the active SaaS's accounts over the last STATS_HISTORY_DAYS days. */
export function useTikTokStats() {
  const saasId = useCurrentSaasId();
  return useQuery({
    queryKey: acquisitionKeys.stats(saasId),
    queryFn: async (): Promise<TikTokAccountStat[]> => {
      const since = format(subDays(new Date(), STATS_HISTORY_DAYS), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("tiktok_account_stats")
        .select("*")
        .eq("saas_id", saasId!)
        .gte("day", since)
        .order("day");
      if (error) throw error;
      return data;
    },
    enabled: !!saasId,
  });
}

/**
 * Adds an account by handle to the active SaaS (or to `forSaasId`); the server fetches its stats
 * before answering.
 */
export function useAddTikTokAccount(forSaasId?: string) {
  const queryClient = useQueryClient();
  const currentSaasId = useCurrentSaasId();
  const saasId = forSaasId ?? currentSaasId;
  return useMutation({
    mutationFn: (handle: string) => {
      if (!saasId) throw new Error("Crée d'abord un SaaS depuis la barre latérale.");
      const body: AddTikTokAccountRequest = { saasId, handle };
      return apiRequest<TikTokAccount>(acquisitionApi.accounts.path, { method: "POST", body });
    },
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.all });
      toast(
        account.sync_error
          ? { title: `@${account.handle} ajouté`, description: account.sync_error }
          : { title: `@${account.handle} ajouté`, description: "Ses statistiques sont à jour." },
      );
    },
  });
}

type SyncVariables = { id: string };

/**
 * The day's analysis of an account, sent by the page itself (useAutoSyncTikTokAccounts): no toast,
 * a failure shows on the account (sync_error, recorded by the server).
 */
function useSyncTikTokAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SYNC_MUTATION_KEY,
    mutationFn: ({ id }: SyncVariables) => apiRequest<TikTokAccount>(acquisitionApi.sync.path(id), { method: "POST" }),
    // The server also records failures on the account (sync_error): reload in every case.
    onSettled: () => queryClient.invalidateQueries({ queryKey: acquisitionKeys.all }),
  });
}

/**
 * "Vérifier ma vidéo" (the first video's task): refreshes every TikTok account of the SaaS now, and
 * answers them (sync_error on those that failed). The caller reads the roadmap again.
 */
export function useCheckFirstVideo(saasId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const body: CheckFirstVideoRequest = { saasId };
      return apiRequest<TikTokAccount[]>(acquisitionApi.firstVideo.path, { method: "POST", body });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: acquisitionKeys.all }),
  });
}

/** Ids of the accounts being refreshed right now (from any component). */
export function useSyncingAccountIds(): string[] {
  return useMutationState({
    filters: { mutationKey: SYNC_MUTATION_KEY, status: "pending" },
    select: (mutation) => (mutation.state.variables as SyncVariables).id,
  });
}

/** Removes an account straight in Supabase (RLS); its videos and snapshots follow (cascade). */
export function useDeleteTikTokAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: TikTokAccount) => {
      const { error } = await supabase.from("tiktok_accounts").delete().eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: (_data, account) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.all });
      toast({ title: `@${account.handle} retiré`, description: "Ses statistiques ont été supprimées." });
    },
    onError: (error) => {
      toast({ variant: "destructive", ...translateSupabaseError(error, "Suppression impossible") });
    },
  });
}

/**
 * The day's analysis: the first opening of the page on a day refreshes the accounts not refreshed
 * yet that day (syncedToday), once per visit. No background job, no button: the stats stay fresh
 * for the members who look at them, at one analysis per account and day.
 */
export function useAutoSyncTikTokAccounts(accounts: TikTokAccount[] | undefined) {
  const sync = useSyncTikTokAccount();
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    for (const account of accounts ?? []) {
      if (syncedToday(account.sync_attempted_at) || attempted.current.has(account.id)) continue;
      attempted.current.add(account.id);
      sync.mutate({ id: account.id });
    }
    // sync.mutate is stable; re-run only when the accounts change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);
}
