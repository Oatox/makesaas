import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IDEA_BATCH_RUNNING_AT_MOST_MS,
  SAAS_IDEA_BATCH_COLUMNS,
  SAAS_IDEA_COLUMNS,
  ideasApi,
  revealedSeries,
  type NextIdeasBody,
  type NextIdeasResult,
  type SaasIdea,
  type SaasIdeaBatch,
} from "@shared/ideas";
import { goalOf } from "@/components/onboarding/insights";
import { buildOnboardingProfile } from "@/components/onboarding/profile";
import { ApiError, apiRequest } from "@/lib/api-client";
import { loadOnboardingProgress } from "@/lib/onboarding-storage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./use-auth";

export const ideaKeys = {
  list: (userId: string | undefined) => ["saas-ideas", userId] as const,
};

/** Latest requests read, with their ideas (12 each). */
const BATCHES_READ = 10;
/** How often the page looks for the ideas of a request running elsewhere (the payment webhook, another tab). */
const RUNNING_POLL_MS = 2_500;

type IdeasSnapshot = { ideas: SaasIdea[]; batches: SaasIdeaBatch[] };

/** A request still being written (one "running" for too long was cut off). */
export function isRunning(batch: SaasIdeaBatch | null | undefined) {
  return batch?.status === "running" && Date.now() - new Date(batch.created_at).getTime() < IDEA_BATCH_RUNNING_AT_MOST_MS;
}

/**
 * The member's SaaS ideas (/lancement), read straight from Supabase (RLS: own rows) and cut in the
 * series shown so far (revealedSeries), newest first. `next` shows the following series: from the
 * ideas in stock at once, or from a new request (about a minute). While a request is running (by this
 * page, the payment webhook or another tab), the hook looks for its ideas every few seconds.
 */
export function useIdeas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery<IdeasSnapshot>({
    queryKey: ideaKeys.list(userId),
    // Both in one snapshot: a request marked written always comes with its ideas.
    queryFn: async () => {
      const batches = await supabase
        .from("saas_idea_batches")
        .select(SAAS_IDEA_BATCH_COLUMNS)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(BATCHES_READ);
      if (batches.error) throw batches.error;
      const rows = (batches.data ?? []) as SaasIdeaBatch[];
      const shown = rows.filter((batch) => batch.revealed > 0).map((batch) => batch.id);
      if (!shown.length) return { ideas: [], batches: rows };

      const ideas = await supabase.from("saas_ideas").select(SAAS_IDEA_COLUMNS).in("batch_id", shown);
      if (ideas.error) throw ideas.error;
      return { ideas: (ideas.data ?? []) as SaasIdea[], batches: rows };
    },
    enabled: !!userId,
    refetchInterval: (current) => (isRunning(current.state.data?.batches[0]) ? RUNNING_POLL_MS : false),
  });

  const series = useMemo(() => revealedSeries(query.data?.batches ?? [], query.data?.ideas ?? []), [query.data]);
  const latest = query.data?.batches[0] ?? null;

  const nextMutation = useMutation({
    mutationFn: (body: NextIdeasBody) => apiRequest<NextIdeasResult>(ideasApi.next.path, { method: "POST", body }),
    // The new series, or (409) the request another tab is running: read them again.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ideaKeys.list(userId) }),
  });

  const error = nextMutation.error;
  return {
    series,
    latest,
    isLoading: query.isLoading,
    isError: query.isError,
    retry: () => void query.refetch(),
    next: nextMutation.mutate,
    /** The next series is on its way: asked by this page, or a request running elsewhere. */
    isWriting: nextMutation.isPending || isRunning(latest),
    /** Why the last request failed; a 409 is not a failure (another request is running, its ideas will show up). */
    generateError: error && !(error instanceof ApiError && error.status === 409) ? error : null,
  };
}

/**
 * Saves the onboarding answers kept on this device on the member's profile (once per page), so that
 * the ideas started by the payment webhook can use them, with the monthly goal they picked (the
 * summit of their roadmap). Called by the paywall once signed in, and by /lancement.
 */
export function useSaveOnboardingProfile() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const answers = loadOnboardingProgress().answers;
    const lines = buildOnboardingProfile(answers);
    if (!lines.length) return;
    // Only a goal picked on the slider: goalOf falls back to a default otherwise.
    const goal = typeof answers.revenu === "string" ? goalOf(answers) : null;
    void supabase
      .from("profiles")
      .update({ onboarding_profile: lines, ...(goal ? { monthly_goal: goal } : {}) })
      .eq("id", userId)
      .then(({ error }) => {
        // Not blocking: /lancement sends them again with its own request.
        if (error) console.warn("Onboarding answers not saved", error.message);
      });
  }, [userId]);
}
