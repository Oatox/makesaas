import type { Express } from "express";
import { z } from "zod";
import { SUBSCRIPTION_SUMMARY_COLUMNS, renewsBilling, type SubscriptionSummary } from "@shared/billing";
import { getUserId, requireAdmin } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { removeUserFiles } from "../storage/files";
import { mapProviders, mapSessionRow, type AdminSessionPayload } from "./mappers";
import { JOURNEY_PROFILE_COLUMNS, readDiscussion, readJourney, readSaasDetail } from "./member";

const userParamsSchema = z.object({ id: z.string().uuid() });
const sessionParamsSchema = userParamsSchema.extend({ sessionId: z.string().uuid() });
const saasParamsSchema = userParamsSchema.extend({ saasId: z.string().uuid() });
const discussionParamsSchema = userParamsSchema.extend({ conversationId: z.string().uuid() });

const updateUserBodySchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    // Manual grant (true) or removal (false) of the subscription. Does not touch the Whop billing:
    // a later webhook of a paying member applies their membership again.
    subscribed: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.role !== undefined || body.subscribed !== undefined, {
    message: "Aucune modification fournie",
  });

const PROFILE_COLUMNS = `id,email,full_name,avatar_url,role,created_at,last_active_at,signup_source,${JOURNEY_PROFILE_COLUMNS}`;

/**
 * Admin access change: a grant activates the existing row (a Whop one keeps its billing data) or
 * creates a manual one; a removal deletes the row.
 */
async function setManualSubscription(userId: string, subscribed: boolean) {
  const db = supabaseAdmin!;
  const { error } = subscribed
    ? await db
        .from("subscriptions")
        .upsert({ user_id: userId, status: "active", updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    : await db.from("subscriptions").delete().eq("user_id", userId);

  if (error) {
    logger.error({ err: error, userId, subscribed }, "Failed to update subscription");
    throw new HttpError(500, "Impossible de mettre à jour l'abonnement.");
  }
}

/** Admin-only operations that need the service key (auth schema, protected profile fields). */
export function registerAdminRoutes(app: Express) {
  // requireAdmin answers 503 when Supabase is not configured, so the client is set below.
  const db = () => supabaseAdmin!;

  app.get(
    "/api/admin/users/:id/details",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id: userId } = parseInput(userParamsSchema, req.params);

      const [profileResult, subscriptionResult, authUserResult, sessionsResult] = await Promise.all([
        db().from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
        db().from("subscriptions").select(SUBSCRIPTION_SUMMARY_COLUMNS).eq("user_id", userId).maybeSingle(),
        db().auth.admin.getUserById(userId),
        db().rpc("admin_list_user_sessions", { p_user_id: userId }),
      ]);

      if (profileResult.error) {
        logger.error({ err: profileResult.error, userId }, "Failed to fetch profile details");
        throw new HttpError(500, "Impossible de charger le profil.");
      }
      const profile = profileResult.data;
      if (!profile) throw new HttpError(404, "Utilisateur introuvable.");

      if (subscriptionResult.error) {
        logger.error({ err: subscriptionResult.error, userId }, "Failed to fetch subscription");
        throw new HttpError(500, "Impossible de charger l'abonnement.");
      }
      if (authUserResult.error) {
        logger.error({ err: authUserResult.error, userId }, "Failed to fetch auth user details");
      }
      if (sessionsResult.error) {
        logger.warn({ err: sessionsResult.error, userId }, "Failed to fetch auth sessions");
      }

      const journey = await readJourney(db(), userId, profile);
      const authUser = authUserResult.data.user;
      const metadataName = authUser?.user_metadata?.full_name;
      const sessions: AdminSessionPayload[] = sessionsResult.error
        ? []
        : ((sessionsResult.data ?? []) as Record<string, unknown>[]).map(mapSessionRow);

      res.json({
        profile: {
          id: profile.id,
          email: profile.email ?? authUser?.email ?? null,
          fullName: profile.full_name ?? (typeof metadataName === "string" ? metadataName : null),
          avatarUrl: profile.avatar_url ?? null,
          role: profile.role,
          subscription: (subscriptionResult.data as SubscriptionSummary | null) ?? null,
          createdAt: profile.created_at,
          lastActiveAt: profile.last_active_at,
          lastSignInAt: authUser?.last_sign_in_at ?? null,
          signupSource: profile.signup_source ?? null,
        },
        sessions,
        sessionsUnavailable: Boolean(sessionsResult.error),
        providers: mapProviders(authUser),
        journey,
      });
    }),
  );

  // One SaaS of the member and where it stands; looking writes nothing (shared/admin.ts).
  app.get(
    "/api/admin/users/:id/saas/:saasId",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id: userId, saasId } = parseInput(saasParamsSchema, req.params);
      res.json(await readSaasDetail(db(), userId, saasId));
    }),
  );

  // A discussion of the member with Gus, to read it as they did.
  app.get(
    "/api/admin/users/:id/discussions/:conversationId",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id: userId, conversationId } = parseInput(discussionParamsSchema, req.params);
      res.json(await readDiscussion(db(), userId, conversationId));
    }),
  );

  // Role and subscription are protected columns: browser sessions cannot write them, admins included.
  app.patch(
    "/api/admin/users/:id",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id: userId } = parseInput(userParamsSchema, req.params);
      const updates = parseInput(updateUserBodySchema, req.body);

      if (updates.role !== undefined && userId === getUserId(res)) {
        throw new HttpError(400, "Vous ne pouvez pas modifier votre propre rôle.");
      }

      const { data, error } = await db()
        .from("profiles")
        .update({ ...(updates.role ? { role: updates.role } : {}), updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("id");

      if (error) {
        logger.error({ err: error, userId }, "Failed to update user");
        throw new HttpError(500, "Impossible de mettre à jour l'utilisateur.");
      }
      if (!data?.length) throw new HttpError(404, "Utilisateur introuvable.");

      if (updates.subscribed !== undefined) await setManualSubscription(userId, updates.subscribed);

      res.status(204).end();
    }),
  );

  // Deleting the auth user cascades to the profile and all their data (refused while their Whop subscription renews).
  app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id: userId } = parseInput(userParamsSchema, req.params);

      if (userId === getUserId(res)) {
        throw new HttpError(400, "Supprimez votre propre compte depuis les paramètres.");
      }

      await deleteAuthUser(userId, "admin");
      res.status(204).end();
    }),
  );

  app.delete(
    "/api/admin/users/:id/sessions/:sessionId",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id: userId, sessionId } = parseInput(sessionParamsSchema, req.params);

      const { error } = await db().rpc("admin_revoke_user_session", { p_user_id: userId, p_session_id: sessionId });
      if (error) {
        logger.error({ err: error, userId, sessionId }, "Failed to revoke session");
        throw new HttpError(500, "Impossible de révoquer la session.");
      }

      res.status(204).end();
    }),
  );

  app.post(
    "/api/admin/users/:id/sessions/revoke-all",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id: userId } = parseInput(userParamsSchema, req.params);

      const { data, error } = await db().rpc("admin_revoke_all_user_sessions", { p_user_id: userId });
      if (error) {
        logger.error({ err: error, userId }, "Failed to revoke all sessions");
        throw new HttpError(500, "Impossible de révoquer les sessions.");
      }

      res.json({ revokedCount: typeof data === "number" ? data : 0 });
    }),
  );
}

/** Who deletes an account: its member (from the settings) or an admin. */
type DeletedBy = "member" | "admin";

const RENEWING_SUBSCRIPTION_MESSAGES: Record<DeletedBy, string> = {
  member: "Votre abonnement se renouvelle encore : résiliez-le d'abord depuis vos paramètres, puis supprimez votre compte.",
  admin: "Ce membre a un abonnement Whop qui se renouvelle : annulez-le d'abord sur Whop, sinon il continuerait d'être prélevé.",
};

/**
 * Removes the auth user; the profile and every table of theirs follow through ON DELETE CASCADE, and their
 * files in the R2 bucket are removed in the background. Refused (409) while their Whop subscription renews:
 * Whop would keep billing them, and the webhook ignores a deleted user.
 */
export async function deleteAuthUser(userId: string, by: DeletedBy): Promise<void> {
  const { data: subscription, error: readError } = await supabaseAdmin!
    .from("subscriptions")
    .select("provider, status, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) {
    logger.error({ err: readError, userId }, "Failed to read the subscription of a user to delete");
    throw new HttpError(500, "Impossible de supprimer le compte.");
  }
  if (renewsBilling(subscription)) throw new HttpError(409, RENEWING_SUBSCRIPTION_MESSAGES[by]);

  const { error } = await supabaseAdmin!.auth.admin.deleteUser(userId);
  if (!error) {
    void removeUserFiles(userId);
    return;
  }

  if (error.status === 404) throw new HttpError(404, "Utilisateur introuvable.");
  logger.error({ err: error, userId }, "Failed to delete user");
  throw new HttpError(500, "Impossible de supprimer le compte.");
}
