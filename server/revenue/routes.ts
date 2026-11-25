import type { Express } from "express";
import { connectRevenueBodySchema, revenueApi, revenueSaasSchema } from "@shared/revenue";
import { getUserId, requireSubscriber } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { loadSecretBox } from "./secret-box";
import { RevenueService } from "./service";

/**
 * Revenue dashboard of one of the member's SaaS (saasId, checked to be theirs: 404 otherwise).
 * Removing an account goes straight to Supabase (RLS).
 */
export function registerRevenueRoutes(app: Express) {
  const box = loadSecretBox();
  const service = box && supabaseAdmin ? new RevenueService(supabaseAdmin, box) : null;
  if (!service) logger.warn("Revenue dashboard disabled: SUPABASE_SECRET_KEY is not set (it also derives the encryption key)");

  const requireService = () => {
    if (!service) throw new HttpError(503, "Le suivi des revenus n'est pas configuré sur ce serveur.");
    return service;
  };

  app.get(
    revenueApi.dashboard.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      const { saasId } = parseInput(revenueSaasSchema, req.query);
      res.set("Cache-Control", "no-store").json(await requireService().getDashboard(getUserId(res), saasId));
    }),
  );

  app.post(
    revenueApi.refresh.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      const { saasId } = parseInput(revenueSaasSchema, req.body);
      res.json(await requireService().refresh(getUserId(res), saasId));
    }),
  );

  app.post(
    revenueApi.connect.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      const body = parseInput(connectRevenueBodySchema, req.body);
      res.status(201).json(await requireService().connect(getUserId(res), body));
    }),
  );
}
