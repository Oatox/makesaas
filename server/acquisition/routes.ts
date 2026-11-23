import type { Express } from "express";
import { z } from "zod";
import {
  acquisitionApi,
  normalizeTikTokHandle,
  TIKTOK_MAX_ACCOUNTS,
  TIKTOK_SYNC_COOLDOWN_MINUTES,
} from "@shared/acquisition";
import type { TikTokAccount } from "@shared/schema";
import { getUserId, requireSubscriber } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { HOUR_MS, MINUTE_MS } from "../lib/time";
import { ScrapeCreatorsClient, ScrapeCreatorsError, TikTokAccountNotFoundError } from "./scrapecreators";
import { syncTikTokAccount } from "./sync";

const addAccountBodySchema = z.object({ saasId: z.string().uuid(), handle: z.string().max(200) });
const accountParamsSchema = z.object({ id: z.string().uuid() });

// Adding an account costs credits and removing one is free (straight to Supabase): without this cap,
// removing and re-adding accounts in a loop would drain the ScrapeCreators credits. Kept in memory:
// enough for a single server instance.
const MAX_ADDS_PER_HOUR = 10;
const recentAdds = new Map<string, number[]>();

function takeAddSlot(userId: string): boolean {
  const since = Date.now() - HOUR_MS;
  const adds = (recentAdds.get(userId) ?? []).filter((time) => time > since);
  if (adds.length >= MAX_ADDS_PER_HOUR) return false;
  adds.push(Date.now());
  recentAdds.set(userId, adds);
  return true;
}

/** French error for a failed fetch of the account's stats. */
function toHttpError(err: unknown, handle: string): HttpError {
  if (err instanceof TikTokAccountNotFoundError) {
    return new HttpError(404, `Aucun compte TikTok public trouvé pour @${handle}. Vérifie le pseudo.`);
  }
  if (err instanceof ScrapeCreatorsError) {
    // Invalid key or no credits left: the owner of the app must act, the user can only wait.
    if (err.status === 401 || err.status === 402 || err.status === 403) {
      logger.error({ err }, "ScrapeCreators refused the request: check SCRAPECREATORS_API_KEY and the credits left");
      return new HttpError(503, "Le suivi TikTok est momentanément indisponible, réessaie plus tard.");
    }
    logger.error({ err, handle }, "TikTok stats fetch failed");
    return new HttpError(502, "TikTok n'a pas répondu, réessaie dans un instant.");
  }
  logger.error({ err, handle }, "TikTok account sync failed");
  return new HttpError(500, "Impossible d'enregistrer les statistiques de ce compte.");
}

/** Shown on the account until a refresh succeeds. */
async function recordSyncError(accountId: string, message: string) {
  const { error } = await supabaseAdmin!.from("tiktok_accounts").update({ sync_error: message }).eq("id", accountId);
  if (error) logger.error({ err: error, accountId }, "Failed to record the TikTok sync error");
}

/** Acquisition page: TikTok accounts tracked by @handle (public stats from ScrapeCreators). */
export function registerAcquisitionRoutes(app: Express) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  const scraper = apiKey ? new ScrapeCreatorsClient(apiKey) : null;
  if (!scraper) logger.warn("SCRAPECREATORS_API_KEY missing: acquisition routes answer 503");

  // Adds an account: checks the handle exists, then saves its profile, latest videos and snapshot.
  app.post(
    acquisitionApi.accounts.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      if (!scraper) throw new HttpError(503, "Le suivi TikTok n'est pas configuré sur ce serveur.");
      const userId = getUserId(res);
      const body = parseInput(addAccountBodySchema, req.body);
      const handle = normalizeTikTokHandle(body.handle);
      if (!handle) throw new HttpError(400, "Ce pseudo TikTok n'est pas valide.");

      // requireSubscriber answers 503 when Supabase is not configured, so the client is set here.
      const db = supabaseAdmin!;
      // The (saas_id, user_id) foreign key enforces it too: this gives a clean 404 first.
      const [saas, accounts] = await Promise.all([
        db.from("saas").select("id").eq("id", body.saasId).eq("user_id", userId).maybeSingle(),
        db.from("tiktok_accounts").select("saas_id, handle").eq("user_id", userId),
      ]);
      const error = saas.error ?? accounts.error;
      if (error) {
        logger.error({ err: error }, "Failed to check the SaaS and TikTok accounts");
        throw new HttpError(500, "Impossible de vérifier tes comptes.");
      }
      if (!saas.data) throw new HttpError(404, "SaaS introuvable.");
      const userAccounts = accounts.data ?? [];
      if (userAccounts.some((account) => account.saas_id === body.saasId && account.handle === handle)) {
        throw new HttpError(409, `Tu suis déjà @${handle} pour ce SaaS.`);
      }
      // The limit counts the accounts of every SaaS of the user (TIKTOK_MAX_ACCOUNTS).
      if (userAccounts.length >= TIKTOK_MAX_ACCOUNTS) {
        throw new HttpError(
          409,
          `Tu suis déjà ${TIKTOK_MAX_ACCOUNTS} comptes (tous SaaS confondus) : retires-en un pour en ajouter un autre.`,
        );
      }
      if (!takeAddSlot(userId)) {
        throw new HttpError(429, "Trop de comptes ajoutés en peu de temps, réessaie dans une heure.");
      }

      let profile;
      try {
        profile = await scraper.getProfile(handle);
      } catch (err) {
        throw toHttpError(err, handle);
      }

      const { data: account, error: insertError } = await db
        .from("tiktok_accounts")
        .insert({
          user_id: userId,
          saas_id: body.saasId,
          handle: profile.handle,
          tiktok_user_id: profile.tiktokUserId,
          nickname: profile.nickname,
          avatar_url: profile.avatarUrl,
          verified: profile.verified,
          is_private: profile.isPrivate,
          followers: profile.followers,
          following: profile.following,
          likes: profile.likes,
          video_count: profile.videoCount,
          sync_attempted_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (insertError) {
        // Two adds of the same account at once: the unique (saas_id, handle) keeps one.
        if (insertError.code === "23505") throw new HttpError(409, `Tu suis déjà @${profile.handle} pour ce SaaS.`);
        // The SaaS was deleted meanwhile (composite foreign key).
        if (insertError.code === "23503") throw new HttpError(404, "SaaS introuvable.");
        logger.error({ err: insertError }, "Failed to add a TikTok account");
        throw new HttpError(500, "Impossible d'ajouter ce compte.");
      }

      // The account stays added even if its videos could not be fetched: its card shows the error
      // and it can be refreshed later.
      try {
        res.status(201).json(await syncTikTokAccount(db, scraper, account as TikTokAccount, profile));
      } catch (err) {
        const httpError = toHttpError(err, profile.handle);
        await recordSyncError(account.id, httpError.message);
        res.status(201).json({ ...account, sync_error: httpError.message });
      }
    }),
  );

  // Refreshes an account, at most once every TIKTOK_SYNC_COOLDOWN_MINUTES (failed attempts included).
  app.post(
    acquisitionApi.sync.route,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      if (!scraper) throw new HttpError(503, "Le suivi TikTok n'est pas configuré sur ce serveur.");
      const userId = getUserId(res);
      const { id } = parseInput(accountParamsSchema, req.params);
      const db = supabaseAdmin!;

      // Atomic claim of the refresh: concurrent requests (two tabs, double click) bill credits once.
      const cooldownStart = new Date(Date.now() - TIKTOK_SYNC_COOLDOWN_MINUTES * MINUTE_MS).toISOString();
      const { data: claimed, error } = await db
        .from("tiktok_accounts")
        .update({ sync_attempted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .or(`sync_attempted_at.is.null,sync_attempted_at.lt."${cooldownStart}"`)
        .select()
        .maybeSingle();
      if (error) {
        logger.error({ err: error }, "Failed to claim a TikTok account refresh");
        throw new HttpError(500, "Impossible d'actualiser ce compte.");
      }

      if (!claimed) {
        const { data: account } = await db
          .from("tiktok_accounts")
          .select("sync_attempted_at")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!account) throw new HttpError(404, "Ce compte n'est plus suivi.");
        const nextAt = new Date(account.sync_attempted_at).getTime() + TIKTOK_SYNC_COOLDOWN_MINUTES * MINUTE_MS;
        const minutes = Math.max(1, Math.ceil((nextAt - Date.now()) / MINUTE_MS));
        throw new HttpError(429, `Ce compte vient d'être actualisé : réessaie dans ${minutes} min.`);
      }

      try {
        res.json(await syncTikTokAccount(db, scraper, claimed as TikTokAccount));
      } catch (err) {
        const httpError =
          err instanceof TikTokAccountNotFoundError
            ? new HttpError(404, `@${claimed.handle} est introuvable sur TikTok : le compte a peut-être changé de pseudo.`)
            : toHttpError(err, claimed.handle);
        await recordSyncError(id, httpError.message);
        throw httpError;
      }
    }),
  );
}
