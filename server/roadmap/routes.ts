import type { Express } from "express";
import { COACH_CONVERSATION_COLUMNS } from "@shared/coach";
import {
  FIRST_MISSION_TITLE,
  appUrlBodySchema,
  firstMissionBodySchema,
  roadmapApi,
  roadmapSaasQuerySchema,
  type FirstMissionResult,
} from "@shared/roadmap";
import { getUserId, requireSubscriber } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { firstMissionMessages } from "./first-mission";
import { projectOf, RoadmapService } from "./service";

/**
 * The roadmap of a SaaS (/roadmap): its state (checked against the SaaS's data on every read), the
 * address of the member's app, and the discussion of the first mission with Gus.
 */
export function registerRoadmapRoutes(app: Express) {
  // requireSubscriber answers 503 when Supabase is not configured, so the client is set in the routes.
  const roadmap = () => new RoadmapService(supabaseAdmin!);

  app.get(
    roadmapApi.state.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      const { saasId } = parseInput(roadmapSaasQuerySchema, req.query);
      res.json(await roadmap().state(getUserId(res), saasId));
    }),
  );

  // The browser has checked that the address answers (the server never fetches member URLs).
  app.put(
    roadmapApi.appUrl.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      const { saasId, url } = parseInput(appUrlBodySchema, req.body);
      res.json(await roadmap().setAppUrl(getUserId(res), saasId, url));
    }),
  );

  // Opens the discussion "Mettre ton app en ligne" with Gus's prompt, or finds the one already opened.
  app.post(
    roadmapApi.firstMission.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      const userId = getUserId(res);
      const { saasId } = parseInput(firstMissionBodySchema, req.body);
      const db = supabaseAdmin!;

      const saas = await roadmap().ownSaas(userId, saasId);

      const existing = await db
        .from("coach_conversations")
        .select("id")
        .eq("saas_id", saasId)
        .eq("user_id", userId)
        .eq("title", FIRST_MISSION_TITLE)
        .limit(1);
      if (existing.error) throw existing.error;
      if (existing.data[0]) {
        const answer: FirstMissionResult = { conversationId: existing.data[0].id };
        return res.json(answer);
      }

      const { question, answer } = firstMissionMessages(projectOf(saas));

      const created = await db
        .from("coach_conversations")
        .insert({ user_id: userId, saas_id: saasId, title: FIRST_MISSION_TITLE })
        .select(COACH_CONVERSATION_COLUMNS)
        .single();
      if (created.error) {
        logger.error({ err: created.error, saasId }, "Failed to open the first mission");
        throw new HttpError(500, "Impossible de préparer ta mission.");
      }
      const conversationId = created.data.id as string;

      // One after the other: the discussion is read in the order of created_at.
      for (const message of [
        { role: "user", content: question },
        { role: "assistant", content: answer },
      ]) {
        const saved = await db
          .from("coach_messages")
          .insert({ conversation_id: conversationId, user_id: userId, ...message })
          .select("created_at")
          .single();
        if (saved.error) {
          logger.error({ err: saved.error, conversationId }, "Failed to write the first mission");
          await db.from("coach_conversations").delete().eq("id", conversationId);
          throw new HttpError(500, "Impossible de préparer ta mission.");
        }
        await db.from("coach_conversations").update({ updated_at: saved.data.created_at }).eq("id", conversationId);
      }

      const result: FirstMissionResult = { conversationId };
      res.json(result);
    }),
  );
}
