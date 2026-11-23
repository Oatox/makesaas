import type { Express } from "express";
import { z } from "zod";
import { SAAS_COLUMNS, SAAS_LOGO_MAX_BYTES, saasApi } from "@shared/saas";
import { getUserId, requireSubscriber, requireUser } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { imageBody, readImage, removeFileByUrl, storageKeys, storeImage } from "../storage/files";
import { requireStorage } from "../storage/r2";

const saasParamsSchema = z.object({ id: z.string().uuid() });

/** The member's SaaS with its current logo; 404 when it is not theirs. */
async function readOwnSaas(userId: string, saasId: string) {
  const { data, error } = await supabaseAdmin!
    .from("saas")
    .select("id, logo_url")
    .eq("id", saasId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logger.error({ err: error, saasId }, "Failed to read a SaaS");
    throw new HttpError(500, "Impossible de lire ce SaaS.");
  }
  if (!data) throw new HttpError(404, "SaaS introuvable.");
  return data;
}

async function setLogoUrl(userId: string, saasId: string, logoUrl: string | null) {
  const { data, error } = await supabaseAdmin!
    .from("saas")
    .update({ logo_url: logoUrl })
    .eq("id", saasId)
    .eq("user_id", userId)
    .select(SAAS_COLUMNS)
    .maybeSingle();
  if (error) {
    logger.error({ err: error, saasId }, "Failed to update a SaaS logo");
    throw new HttpError(500, "Impossible d'enregistrer le logo.");
  }
  if (!data) throw new HttpError(404, "SaaS introuvable.");
  return data;
}

/**
 * The SaaS's files in the R2 bucket. The rest of their CRUD goes straight to Supabase; logo_url is
 * written here only (members cannot point it anywhere else).
 */
export function registerSaasRoutes(app: Express) {
  const logoPath = saasApi.logo(":id");

  // A new logo (resized by the browser): stored in the SaaS's folder, the previous one is removed.
  app.put(
    logoPath,
    requireSubscriber,
    imageBody(SAAS_LOGO_MAX_BYTES, `Logo trop lourd : ${SAAS_LOGO_MAX_BYTES / 1024 / 1024} Mo maximum.`),
    asyncRoute(async (req, res) => {
      const files = requireStorage();
      const userId = getUserId(res);
      const { id } = parseInput(saasParamsSchema, req.params);
      const image = readImage(req);
      const previous = await readOwnSaas(userId, id);

      const url = await storeImage(files, storageKeys.saasLogo(userId, id), image);
      let saas;
      try {
        saas = await setLogoUrl(userId, id, url);
      } catch (err) {
        await removeFileByUrl(files, url);
        throw err;
      }
      await removeFileByUrl(files, previous.logo_url);
      res.json(saas);
    }),
  );

  // Back to the initials.
  app.delete(
    logoPath,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      const files = requireStorage();
      const userId = getUserId(res);
      const { id } = parseInput(saasParamsSchema, req.params);
      const previous = await readOwnSaas(userId, id);

      const saas = await setLogoUrl(userId, id, null);
      await removeFileByUrl(files, previous.logo_url);
      res.json(saas);
    }),
  );

  // Once the member has deleted a SaaS (straight from Supabase): its logo and carousel images go too.
  app.delete(
    saasApi.files(":id"),
    requireUser,
    asyncRoute(async (req, res) => {
      const files = requireStorage();
      const userId = getUserId(res);
      const { id } = parseInput(saasParamsSchema, req.params);

      const { data: saas, error } = await supabaseAdmin!.from("saas").select("id").eq("id", id).maybeSingle();
      if (error) {
        logger.error({ err: error, saasId: id }, "Failed to check a deleted SaaS");
        throw new HttpError(500, "Impossible de supprimer les fichiers.");
      }
      if (saas) throw new HttpError(409, "Ce SaaS existe encore.");

      // The prefix starts with the member's id: only their own files can go.
      try {
        await files.deletePrefix(storageKeys.saas(userId, id));
      } catch (err) {
        logger.error({ err, saasId: id }, "Failed to remove the files of a deleted SaaS");
        throw new HttpError(502, "Les fichiers n'ont pas pu être supprimés.");
      }
      res.status(204).end();
    }),
  );
}
