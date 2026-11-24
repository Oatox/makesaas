import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roadmapApi, type AppUrlBody, type RoadmapState } from "@shared/roadmap";
import type { Saas } from "@shared/saas";
import { ApiError, apiRequest } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";
import { saasKeys } from "./use-saas";
import { useToast } from "./use-toast";

export const roadmapKeys = {
  state: (saasId: string | undefined) => ["roadmap", saasId] as const,
};

/** The roadmap of a SaaS: the missions done, checked by the server against its data on every read. */
export function useRoadmap(saasId: string | undefined) {
  return useQuery<RoadmapState>({
    queryKey: roadmapKeys.state(saasId),
    queryFn: ({ signal }) => apiRequest<RoadmapState>(roadmapApi.state.path, { query: { saasId: saasId! }, signal }),
    enabled: !!saasId,
    staleTime: 60_000,
  });
}

/**
 * Ticks or unticks a mission the member does by hand ("C'est fait"), straight in Supabase (RLS: their
 * own, "declared" only). Shown at once, then read again from the server.
 */
export function useTickMission(saasId: string | undefined) {
  const queryClient = useQueryClient();
  const key = roadmapKeys.state(saasId);

  return useMutation({
    // Unticking a mission unticks it alone: the ones ticked after it stay done.
    mutationFn: async ({ mission, done }: { mission: string; done: boolean }) => {
      const { error } = done
        ? await supabase.from("roadmap_missions").insert({ saas_id: saasId!, key: mission })
        : await supabase.from("roadmap_missions").delete().eq("saas_id", saasId!).eq("key", mission).eq("source", "declared");
      if (error) throw error;
    },
    onMutate: async ({ mission, done }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RoadmapState>(key);
      queryClient.setQueryData<RoadmapState>(key, (state) => {
        if (!state) return state;
        const next = { ...state.done };
        if (done) next[mission] = { at: new Date().toISOString(), source: "declared" };
        else delete next[mission];
        return { ...state, done: next };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/**
 * Whether an address answers, from the browser: a no-cors request resolves when any server answered
 * (its content stays unreadable) and fails when nothing does. The server never fetches member URLs.
 */
export async function addressAnswers(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(8_000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves the address of the member's app (once it answered): its missions are checked again, and the
 * SaaS shows it at once (its settings).
 */
export function useSetAppUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AppUrlBody) => apiRequest<RoadmapState>(roadmapApi.appUrl.path, { method: "PUT", body }),
    onSuccess: (state, body) => {
      queryClient.setQueryData(roadmapKeys.state(body.saasId), state);
      queryClient.setQueriesData<Saas[]>({ queryKey: saasKeys.all }, (list) =>
        list?.map((saas) => (saas.id === body.saasId ? { ...saas, app_url: state.appUrl } : saas)),
      );
    },
  });
}

/**
 * The address of the member's app, from its roadmap task or the SaaS's settings: written as typed
 * ("fitlo.com" becomes https://fitlo.com), checked from the browser (it must answer), then saved.
 * `save` resolves with the address saved, or null after a toast saying why it was not.
 */
export function useSaveAppUrl() {
  const { toast } = useToast();
  const setAppUrl = useSetAppUrl();
  const [checking, setChecking] = useState(false);

  const save = async (saasId: string, typed: string): Promise<string | null> => {
    const value = typed.trim();
    const address = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    setChecking(true);
    const answers = await addressAnswers(address);
    setChecking(false);
    if (!answers) {
      toast({ variant: "destructive", title: "Ton app ne répond pas", description: "Vérifie l'adresse, et que ton app est bien publiée." });
      return null;
    }
    try {
      await setAppUrl.mutateAsync({ saasId, url: address });
      return address;
    } catch (error) {
      toast({ variant: "destructive", title: "Adresse refusée", description: error instanceof ApiError ? error.message : "Réessaie dans un instant." });
      return null;
    }
  };

  return { save, busy: checking || setAppUrl.isPending };
}
