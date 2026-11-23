import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SAAS_COLUMNS,
  SAAS_LIMIT_ERROR,
  SAAS_LOGO_SIZE,
  SAAS_LOGO_SOURCE_MAX_BYTES,
  SAAS_MAX_PER_USER,
  saasApi,
  type Saas,
  type SaasCreate,
  type SaasInput,
} from "@shared/saas";
import { IMAGE_TYPES_LABEL, isImageType } from "@shared/storage";
import { apiRequest } from "@/lib/api-client";
import { resizeImageToFit } from "@/lib/image-resize";
import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/error-translator";
import { profileKeys, useAuth, type AuthProfile } from "./use-auth";

export const saasKeys = {
  list: (userId: string | undefined) => ["saas", userId] as const,
};

/** French toast for a failed SaaS operation, including the database limit on the number of SaaS. */
export function saasErrorMessage(error: unknown, fallbackTitle: string) {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes(SAAS_LIMIT_ERROR)) {
    return { title: "Limite atteinte", description: `Tu peux avoir jusqu'à ${SAAS_MAX_PER_USER} SaaS.` };
  }
  return translateSupabaseError(error, fallbackTitle);
}

/**
 * The member's SaaS and the active one, straight through Supabase (RLS: own rows only).
 * The active SaaS is profiles.current_saas_id, or the oldest one when unset or deleted; null while the
 * member has no SaaS yet. Product data is read for `currentSaas.id` (see useCurrentSaasId).
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
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Saas[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const saasList = useMemo(() => listQuery.data ?? [], [listQuery.data]);
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
    // Optimistic: the sidebar and the pages follow the new SaaS at once; rolled back on error.
    onMutate: (saasId) => {
      const previous = profile?.current_saas_id ?? null;
      setCurrentInProfile(saasId);
      return { previous };
    },
    onError: (_error, _saasId, context) => setCurrentInProfile(context?.previous ?? null),
  });

  // A new SaaS becomes the active one. From an idea, it also takes its description and customer.
  const createMutation = useMutation({
    mutationFn: async (input: SaasCreate) => {
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

  // The data of the SaaS goes with it (ON DELETE CASCADE); the server then removes its files from
  // the bucket (logo, carousel images), in the background.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saas").delete().eq("id", id);
      if (error) throw error;
      void apiRequest(saasApi.files(id), { method: "DELETE" }).catch(() => undefined);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Saas[]>(saasKeys.list(userId), (previous) => (previous ?? []).filter((item) => item.id !== id));
      // The database cleared current_saas_id if it was this one: fall back to the oldest SaaS.
      if (profile?.current_saas_id === id) setCurrentInProfile(null);
    },
  });

  return {
    saasList,
    currentSaas,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    retry: () => void listQuery.refetch(),
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

/**
 * Logo of a SaaS: resized in the browser, then stored by the server in the bucket, which alone
 * writes logo_url. Both mutations answer the updated SaaS, put back in the list.
 */
export function useSaasLogo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const replaceInList = (updated: Saas) =>
    queryClient.setQueryData<Saas[]>(saasKeys.list(user?.id), (previous) =>
      (previous ?? []).map((item) => (item.id === updated.id ? updated : item)),
    );

  const uploadMutation = useMutation({
    mutationFn: async ({ saasId, file }: { saasId: string; file: File }) => {
      if (!isImageType(file.type)) throw new Error(`Formats acceptés : ${IMAGE_TYPES_LABEL}.`);
      if (file.size > SAAS_LOGO_SOURCE_MAX_BYTES) {
        throw new Error(`Image trop lourde : ${SAAS_LOGO_SOURCE_MAX_BYTES / 1024 / 1024} Mo maximum.`);
      }
      const logo = await resizeImageToFit(file, SAAS_LOGO_SIZE);
      return apiRequest<Saas>(saasApi.logo(saasId), { method: "PUT", body: logo });
    },
    onSuccess: replaceInList,
  });

  const removeMutation = useMutation({
    mutationFn: (saasId: string) => apiRequest<Saas>(saasApi.logo(saasId), { method: "DELETE" }),
    onSuccess: replaceInList,
  });

  return {
    uploadLogo: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    removeLogo: removeMutation.mutateAsync,
    isRemoving: removeMutation.isPending,
  };
}

/**
 * Id of the active SaaS, for the hooks reading product data: put it in their query key (switching
 * SaaS then loads the other SaaS's data) and enable them only when it is set.
 */
export function useCurrentSaasId(): string | undefined {
  return useSaas().currentSaas?.id;
}
