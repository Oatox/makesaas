import { useCallback } from "react";
import { useLocation } from "wouter";
import { COACH_NAME } from "@/components/brand/Coach";
import { COACH_PATH, sendToCoach } from "./use-coach";
import { useToast } from "./use-toast";

/**
 * Opens a new discussion with Gus on a message the app writes for the member (analyse this page,
 * help on this mission): the new-discussion page shows it at once, then Gus's answer streams in.
 * Gus knows the member's project, roadmap and figures (server/coach/context.ts).
 */
export function useAskGus() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  return useCallback(
    (saasId: string, content: string) => {
      navigate(COACH_PATH);
      sendToCoach({ saasId, conversationId: null, content }).catch((error: unknown) =>
        toast({
          variant: "destructive",
          title: `${COACH_NAME} n'a pas pu répondre`,
          description: error instanceof Error ? error.message : "Réessaie dans un instant.",
        }),
      );
    },
    [navigate, toast],
  );
}
