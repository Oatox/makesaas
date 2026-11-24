import { useCallback } from "react";
import type { LaunchStep } from "@shared/launch";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { profileKeys, useAuth, type AuthProfile } from "./use-auth";

/**
 * Saves where the member is on /lancement (profiles.launch_step, shared/launch.ts), so they resume
 * there after a reload, a new sign-in or on another device. The profile in cache first, so the routes
 * follow at once (ProtectedRoute), then Supabase. Not blocking: a failed save only loses the resume
 * point. Resolves once saved (or failed).
 */
export function useSaveLaunchStep() {
  const { user } = useAuth();
  const userId = user?.id;

  return useCallback(
    async (step: LaunchStep | null, ideaId: string | null = null) => {
      if (!userId) return;
      const changes = { launch_step: step, launch_idea_id: ideaId };
      const key = profileKeys.detail(userId);
      // A profile read in flight would bring the previous step back over this one.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<AuthProfile | null>(key, (previous) => (previous ? { ...previous, ...changes } : previous));

      const { error } = await supabase.from("profiles").update(changes).eq("id", userId);
      if (error) console.warn("Launch step not saved", error.message);
    },
    [userId],
  );
}
