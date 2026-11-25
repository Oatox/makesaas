import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CAROUSEL_GENERATIONS_PER_DAY,
  CAROUSEL_IMAGE_MAX_BYTES,
  CAROUSEL_TITLE_MAX_LENGTH,
  carouselApi,
  createCarouselDocument,
  generateCarouselBodySchema,
  type CarouselQuota,
} from "@shared/carousel";
import { OneShotClient } from "../ai/oneshot-client";
import { getUserId, requireSubscriber, requireUser } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { DAY_MS, MINUTE_MS } from "../lib/time";
import { imageBody, readImage, storageKeys, storeImage } from "../storage/files";
import { requireStorage } from "../storage/r2";
import { generateCarousel } from "./generate-carousel";
import { removeCarouselImages } from "./storage";

/** A generation still running after this long was cut off (server restart): it is marked failed. */
const INTERRUPTED_AFTER_MS = 15 * MINUTE_MS;

const IMAGES_PATH = carouselApi.images.path(":id");
const carouselParamsSchema = z.object({ id: z.string().uuid() });
const removeImagesQuerySchema = z.object({ saasId: z.string().uuid() });

const parisTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Generations that count over the last 24 hours (running or succeeded), oldest first. */
async function countedGenerations(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("carousel_generations")
    .select("id, created_at")
    .eq("user_id", userId)
    .neq("status", "failed")
    .gte("created_at", new Date(Date.now() - DAY_MS).toISOString())
    .order("created_at");
  if (error) throw error;
  return data;
}

function toQuota(generations: { created_at: string }[]): CarouselQuota {
  const used = generations.length;
  const nextAvailableAt =
    used >= CAROUSEL_GENERATIONS_PER_DAY
      ? new Date(new Date(generations[used - CAROUSEL_GENERATIONS_PER_DAY].created_at).getTime() + DAY_MS).toISOString()
      : null;
  return { used: Math.min(used, CAROUSEL_GENERATIONS_PER_DAY), limit: CAROUSEL_GENERATIONS_PER_DAY, nextAvailableAt };
}

/**
 * Takes one generation of the quota: records it first, then counts, so concurrent requests cannot
 * pass the limit together (the extra one is removed). Returns its id, or null when the quota is reached.
 */
async function claimGeneration(db: SupabaseClient, userId: string): Promise<{ id: string } | { quota: CarouselQuota }> {
  const { data: claimed, error } = await db.from("carousel_generations").insert({ user_id: userId }).select("id").single();
  if (error) throw error;

  const generations = await countedGenerations(db, userId);
  if (generations.length <= CAROUSEL_GENERATIONS_PER_DAY) return { id: claimed.id };

  await db.from("carousel_generations").delete().eq("id", claimed.id);
  return { quota: toQuota(generations.filter((generation) => generation.id !== claimed.id)) };
}

/** Generations cut off by a server restart would stay "generating" forever. */
async function failInterruptedGenerations(db: SupabaseClient) {
  const before = new Date(Date.now() - INTERRUPTED_AFTER_MS).toISOString();
  const results = await Promise.all([
    db
      .from("carousels")
      .update({ status: "failed", error: "La génération a été interrompue : supprime ce carrousel et relance-la." })
      .eq("status", "generating")
      .lt("created_at", before),
    db.from("carousel_generations").update({ status: "failed" }).eq("status", "running").lt("created_at", before),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) logger.error({ err: failed.error }, "Failed to clean up interrupted carousel generations");
}

/**
 * Content page: AI generation of carousels and their images in the R2 bucket (the rest of their CRUD
 * goes straight to Supabase).
 */
export function registerContentRoutes(app: Express) {
  // ONESHOTAPI_KEY: name used by some existing .env files (as for the coach).
  const apiKey = process.env.ONESHOT_API_KEY || process.env.ONESHOTAPI_KEY;
  const oneshot = apiKey ? new OneShotClient(apiKey, { jobTimeoutMs: 4 * MINUTE_MS }) : null;
  if (!oneshot) logger.warn("ONESHOT_API_KEY missing: carousel generation answers 503");
  if (supabaseAdmin) void failInterruptedGenerations(supabaseAdmin);

  app.get(
    carouselApi.quota.path,
    requireSubscriber,
    asyncRoute(async (_req, res) => {
      res.json(toQuota(await countedGenerations(supabaseAdmin!, getUserId(res))));
    }),
  );

  // Answers 202 with the carousel ("generating") at once; the page follows it until it is ready.
  app.post(
    carouselApi.generate.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      if (!oneshot) throw new HttpError(503, "La génération de carrousels n'est pas configurée sur ce serveur.");
      const userId = getUserId(res);
      const body = parseInput(generateCarouselBodySchema, req.body);
      // requireSubscriber answers 503 when Supabase is not configured, so the client is set here.
      const db = supabaseAdmin!;

      const { data: saas, error: saasError } = await db
        .from("saas")
        .select("id, name")
        .eq("id", body.saasId)
        .eq("user_id", userId)
        .maybeSingle();
      if (saasError) {
        logger.error({ err: saasError }, "Failed to read the SaaS of a carousel generation");
        throw new HttpError(500, "Impossible de lancer la génération.");
      }
      if (!saas) throw new HttpError(404, "SaaS introuvable.");

      const claim = await claimGeneration(db, userId);
      if ("quota" in claim) {
        const at = claim.quota.nextAvailableAt ? parisTime.format(new Date(claim.quota.nextAvailableAt)) : null;
        throw new HttpError(
          429,
          `Tu as généré ${CAROUSEL_GENERATIONS_PER_DAY} carrousels sur les dernières 24 h${at ? ` : prochaine génération possible à ${at}` : ""}.`,
        );
      }

      const { data: carousel, error } = await db
        .from("carousels")
        .insert({
          user_id: userId,
          saas_id: saas.id,
          title: body.topic.slice(0, CAROUSEL_TITLE_MAX_LENGTH),
          status: "generating",
          topic: body.topic,
          document: createCarouselDocument(body.ratio, body.slideCount),
        })
        .select()
        .single();
      if (error) {
        logger.error({ err: error }, "Failed to create a generated carousel");
        await db.from("carousel_generations").delete().eq("id", claim.id);
        throw new HttpError(500, "Impossible de lancer la génération.");
      }
      await db.from("carousel_generations").update({ carousel_id: carousel.id }).eq("id", claim.id);

      res.status(202).json(carousel);
      void generateCarousel(db, oneshot, {
        carouselId: carousel.id,
        generationId: claim.id,
        userId,
        saasId: saas.id,
        saasName: saas.name,
        topic: body.topic,
        slideCount: body.slideCount,
        ratio: body.ratio,
        textStyle: body.textStyle,
      });
    }),
  );

  // An image added in the editor: checked here, then stored in the carousel's folder of the bucket.
  app.post(
    IMAGES_PATH,
    requireSubscriber,
    imageBody(CAROUSEL_IMAGE_MAX_BYTES, `Image trop lourde : ${CAROUSEL_IMAGE_MAX_BYTES / 1024 / 1024} Mo maximum.`),
    asyncRoute(async (req, res) => {
      const files = requireStorage();
      const userId = getUserId(res);
      const { id } = parseInput(carouselParamsSchema, req.params);
      const image = readImage(req);

      const { data: carousel, error } = await supabaseAdmin!
        .from("carousels")
        .select("saas_id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        logger.error({ err: error }, "Failed to read the carousel of an image upload");
        throw new HttpError(500, "Impossible d'ajouter l'image.");
      }
      if (!carousel) throw new HttpError(404, "Carrousel introuvable.");

      const url = await storeImage(files, storageKeys.carousel(userId, carousel.saas_id, id), image);
      res.status(201).json({ url });
    }),
  );

  // Once the member has deleted a carousel (straight from Supabase), its images go too.
  app.delete(
    IMAGES_PATH,
    requireUser,
    asyncRoute(async (req, res) => {
      const files = requireStorage();
      const userId = getUserId(res);
      const { id } = parseInput(carouselParamsSchema, req.params);
      const { saasId } = parseInput(removeImagesQuerySchema, req.query);

      const { data: carousel, error } = await supabaseAdmin!.from("carousels").select("id").eq("id", id).maybeSingle();
      if (error) {
        logger.error({ err: error }, "Failed to check a deleted carousel");
        throw new HttpError(500, "Impossible de supprimer les images.");
      }
      if (carousel) throw new HttpError(409, "Ce carrousel existe encore.");

      // The prefix starts with the member's id: only their own files can go.
      await removeCarouselImages(files, { userId, saasId, carouselId: id });
      res.status(204).end();
    }),
  );
}
