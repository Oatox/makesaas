import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SAAS_COLUMNS, SAAS_LAST_ONE_ERROR, type Saas, type SaasInput } from "@shared/saas";
import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/error-translator";
import { profileKeys, useAuth, type AuthProfile } from "./use-auth";

export const saasKeys = {
  list: (userId: string | undefined) => ["saas", userId] as const,
};

/** French message for a failed SaaS operation, including the database rule keeping the last SaaS. */
export function saasErrorMessage(error: unknown, fallbackTitle: string) {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes(SAAS_LAST_ONE_ERROR)) {
    return { title: "Suppression impossible", description: "Tu dois garder au moins un SaaS." };
  }
  return translateSupabaseError(error, fallbackTitle);
}

/**
 * The user's SaaS and the active one, straight through Supabase (RLS: own rows only).
 * The active SaaS is profiles.current_saas_id, or the oldest one when unset or deleted.
 */
export function useSaas() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const listQuery = useQuery<Saas[]>({
    queryKey: saasKeys.list(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas")
        .select(SAAS_COLUMNS)
        .eq("owner_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Saas[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const saasList = listQuery.data ?? [];
  const currentSaas = useMemo(
    () => saasList.find((item) => item.id === profile?.current_saas_id) ?? saasList[0] ?? null,
    [saasList, profile?.current_saas_id],
  );

  const setCurrentInProfile = (saasId: string | null) =>
    queryClient.setQueryData<AuthProfile | null>(profileKeys.detail(userId), (previous) =>
      previous ? { ...previous, current_saas_id: saasId } : previous,
    );

  const persistCurrent = async (saasId: string) => {
    const { error } = await supabase.from("profiles").update({ current_saas_id: saasId }).eq("id", userId!);
    if (error) throw error;
  };

  const switchMutation = useMutation({
    mutationFn: persistCurrent,
    // Optimistic: the sidebar and pages follow the new SaaS at once; rolled back on error.
    onMutate: (saasId) => {
      const previous = profile?.current_saas_id ?? null;
      setCurrentInProfile(saasId);
      return { previous };
    },
    onError: (_error, _saasId, context) => setCurrentInProfile(context?.previous ?? null),
  });

  const createMutation = useMutation({
    mutationFn: async (input: SaasInput) => {
      const { data, error } = await supabase.from("saas").insert(input).select(SAAS_COLUMNS).single();
      if (error) throw error;
      const created = data as Saas;
      await persistCurrent(created.id);
      return created;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Saas[]>(saasKeys.list(userId), (previous) => [...(previous ?? []), created]);
      setCurrentInProfile(created.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: SaasInput & { id: string }) => {
      const { data, error } = await supabase.from("saas").update(input).eq("id", id).select(SAAS_COLUMNS).single();
      if (error) throw error;
      return data as Saas;
    },
    onSuccess: (updated) =>
      queryClient.setQueryData<Saas[]>(saasKeys.list(userId), (previous) =>
        (previous ?? []).map((item) => (item.id === updated.id ? updated : item)),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saas").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Saas[]>(saasKeys.list(userId), (previous) => (previous ?? []).filter((item) => item.id !== id));
      // The database set current_saas_id to null if it was this one: fall back to the oldest SaaS.
      if (profile?.current_saas_id === id) setCurrentInProfile(null);
    },
  });

  return {
    saasList,
    currentSaas,
    isLoading: listQuery.isLoading,
    switchSaas: switchMutation.mutateAsync,
    isSwitching: switchMutation.isPending,
    createSaas: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateSaas: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteSaas: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
