import type { NextFunction, Request, RequestHandler, Response } from "express";
import { activePlan, isPlanId, type PlanId } from "@shared/billing";
import { logger } from "./logger";
import { supabaseAdmin } from "./supabase-admin";

export function getBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  return token || null;
}

/** Rejects the request unless it carries a valid Supabase access token. Read the user with getUserId(res). */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!supabaseAdmin) {
    return res.status(503).json({ message: "Le service d'authentification n'est pas configuré." });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Session expirée. Veuillez vous reconnecter." });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ message: "Session expirée. Veuillez vous reconnecter." });
  }

  res.locals.userId = data.user.id;
  res.locals.userCreatedAt = data.user.created_at;
  next();
}

async function requireAdminRole(_req: Request, res: Response, next: NextFunction) {
  const { data, error } = await supabaseAdmin!.from("profiles").select("role").eq("id", getUserId(res)).maybeSingle();

  if (error) {
    logger.error({ err: error }, "Failed to verify admin role");
    return res.status(500).json({ message: "Impossible de vérifier vos droits." });
  }
  if (data?.role !== "admin") {
    return res.status(403).json({ message: "Accès réservé aux administrateurs." });
  }
  next();
}

/** requireUser, then the admin role check (requireUser guarantees supabaseAdmin is configured). */
export const requireAdmin: RequestHandler[] = [requireUser, requireAdminRole];

async function requirePaidPlan(_req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(res);
  const [profile, subscription] = await Promise.all([
    supabaseAdmin!.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabaseAdmin!.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle(),
  ]);

  const error = profile.error ?? subscription.error;
  if (error) {
    logger.error({ err: error }, "Failed to verify subscription plan");
    return res.status(500).json({ message: "Impossible de vérifier votre abonnement." });
  }

  // Admins get the Pro plan; there is no free plan, everyone else needs a subscription granting access.
  const plan: PlanId | null = profile.data?.role === "admin" ? "pro" : activePlan(subscription.data);
  if (!plan) {
    return res.status(402).json({ message: "Un abonnement est nécessaire pour accéder à l'application.", code: "SUBSCRIPTION_REQUIRED" });
  }

  res.locals.plan = plan;
  next();
}

/** requireUser, then an active paid plan (Starter or Pro; admins count as Pro). Read it with getPlan(res). */
export const requireSubscriber: RequestHandler[] = [requireUser, requirePaidPlan];

/** Plan of the user checked by requireSubscriber; throws if the middleware was not applied. */
export function getPlan(res: Response): PlanId {
  const plan = res.locals.plan;
  if (!isPlanId(plan)) {
    throw new Error("getPlan called on a route without requireSubscriber");
  }
  return plan;
}

/** Id of the user authenticated by requireUser; throws if the middleware was not applied. */
export function getUserId(res: Response): string {
  const userId = res.locals.userId;
  if (typeof userId !== "string") {
    throw new Error("getUserId called on a route without requireUser");
  }
  return userId;
}
