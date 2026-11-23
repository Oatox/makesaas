import type { Express } from "express";
import { appUrlBodySchema, roadmapApi, roadmapSaasQuerySchema } from "@shared/roadmap";
import { getUserId, requireSubscriber } from "../lib/auth";
import { asyncRoute, parseInput } from "../lib/http";
import { supabaseAdmin } from "../lib/supabase-admin";
import { RoadmapService } from "./service";

/**
 * The roadmap of a SaaS (/roadmap): its state (checked against the SaaS's data on every read) and the
 * address of the member's app.
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
}
