import type { NextFunction, Request, RequestHandler, Response } from "express";
import { grantsAccess } from "@shared/billing";
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

async function requireAccess(_req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(res);
  const [profile, subscription] = await Promise.all([
    supabaseAdmin!.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabaseAdmin!.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
  ]);

  const error = profile.error ?? subscription.error;
  if (error) {
    logger.error({ err: error }, "Failed to verify subscription");
    return res.status(500).json({ message: "Impossible de vérifier votre abonnement." });
  }

  // There is no free plan: admins aside, everyone needs a subscription granting access.
  if (profile.data?.role !== "admin" && !grantsAccess(subscription.data?.status)) {
    return res.status(402).json({ message: "Un abonnement est nécessaire pour accéder à l'application.", code: "SUBSCRIPTION_REQUIRED" });
  }

  next();
}

/** requireUser, then a subscription granting access (admins always have access). */
export const requireSubscriber: RequestHandler[] = [requireUser, requireAccess];

/** Id of the user authenticated by requireUser; throws if the middleware was not applied. */
export function getUserId(res: Response): string {
  const userId = res.locals.userId;
  if (typeof userId !== "string") {
    throw new Error("getUserId called on a route without requireUser");
  }
  return userId;
}
