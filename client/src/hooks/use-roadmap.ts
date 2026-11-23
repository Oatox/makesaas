import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roadmapApi, type AppUrlBody, type FirstMissionResult, type RoadmapState } from "@shared/roadmap";
import { apiRequest } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";
import { coachKeys } from "./use-coach";

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
    // Unticking a mission also unticks `also`: the ones ticked after it (ticksAfter).
    mutationFn: async ({ mission, done, also = [] }: { mission: string; done: boolean; also?: string[] }) => {
      const { error } = done
        ? await supabase.from("roadmap_missions").insert({ saas_id: saasId!, key: mission })
        : await supabase
            .from("roadmap_missions")
            .delete()
            .eq("saas_id", saasId!)
            .in("key", [mission, ...also])
            .eq("source", "declared");
      if (error) throw error;
    },
    onMutate: async ({ mission, done, also = [] }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RoadmapState>(key);
      queryClient.setQueryData<RoadmapState>(key, (state) => {
        if (!state) return state;
        const next = { ...state.done };
        if (done) next[mission] = { at: new Date().toISOString(), source: "declared" };
        else for (const key of [mission, ...also]) delete next[key];
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

/** Saves the address of the member's app (once it answered): its mission gets done. */
export function useSetAppUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AppUrlBody) => apiRequest<RoadmapState>(roadmapApi.appUrl.path, { method: "PUT", body }),
    onSuccess: (state, body) => queryClient.setQueryData(roadmapKeys.state(body.saasId), state),
  });
}

/**
 * Opens the discussion of the first mission ("Mettre ton app en ligne"), or finds it: answers its id
 * once the SaaS's discussions are read again, so the page opening it knows it.
 */
export function useFirstMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (saasId: string) => {
      const result = await apiRequest<FirstMissionResult>(roadmapApi.firstMission.path, { method: "POST", body: { saasId } });
      await queryClient.invalidateQueries({ queryKey: coachKeys.conversations(saasId) });
      return result;
    },
  });
}
