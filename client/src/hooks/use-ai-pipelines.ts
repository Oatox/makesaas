import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiPipeline, AiPipelineSlug, AiPipelineUpdate } from "@shared/ai-pipeline";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./use-auth";

const aiPipelineKeys = {
  detail: (slug: AiPipelineSlug) => ["ai-pipelines", slug] as const,
};

// Admin-only, straight through Supabase: RLS restricts read/update to admins and a DB
// trigger stamps updated_at / updated_by.

export function useAiPipeline(slug: AiPipelineSlug) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: aiPipelineKeys.detail(slug),
    queryFn: async (): Promise<AiPipeline | null> => {
      const { data, error } = await supabase.from("ai_pipelines").select("*").eq("slug", slug).maybeSingle();

      if (error) throw error;
      return data as AiPipeline | null;
    },
    enabled: isAdmin,
    staleTime: 0,
  });
}

export function useUpdateAiPipeline(slug: AiPipelineSlug) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: AiPipelineUpdate): Promise<AiPipeline> => {
      const { data, error } = await supabase.from("ai_pipelines").update(update).eq("slug", slug).select("*").single();

      if (error) throw error;
      return data as AiPipeline;
    },
    onSuccess: (pipeline) => queryClient.setQueryData(aiPipelineKeys.detail(slug), pipeline),
  });
}
