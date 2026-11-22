import type { Express } from "express";
import { z } from "zod";
import { signupSourceSchema } from "@shared/schema";
import { deleteAuthUser } from "../admin/routes";
import { getUserId, requireUser } from "../lib/auth";
import { asyncRoute, HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { validateBody } from "../lib/validate";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  signup_source: signupSourceSchema.nullable().optional(),
});

const signupSourceBodySchema = z.object({
  signup_source: signupSourceSchema,
});

// OAuth accounts can only attach their signup source shortly after creation.
const SIGNUP_SOURCE_WINDOW_MS = 60 * 60 * 1000;

export function registerAccountRoutes(app: Express) {
  app.post(
    "/api/auth/register",
    validateBody(registerSchema),
    asyncRoute(async (req, res) => {
      if (!supabaseAdmin) throw new HttpError(503, "Le service d'authentification n'est pas configuré.");

      const { email, password, signup_source } = req.body as z.infer<typeof registerSchema>;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: signup_source ? { signup_source } : {},
      });

      // Supabase auth messages are user-level ("already registered"...): the client translates them.
      if (error) return res.status(400).json({ message: error.message });

      res.status(201).json({ user: data.user });
    }),
  );

  app.post(
    "/api/auth/signup-source",
    requireUser,
    validateBody(signupSourceBodySchema),
    asyncRoute(async (req, res) => {
      const createdAt = new Date(res.locals.userCreatedAt).getTime();
      if (Number.isNaN(createdAt) || Date.now() - createdAt > SIGNUP_SOURCE_WINDOW_MS) {
        return res.status(204).end();
      }

      const userId = getUserId(res);
      const { signup_source } = req.body as z.infer<typeof signupSourceBodySchema>;

      // Write-once: never overwrite a source already recorded at signup.
      const { error } = await supabaseAdmin!
        .from("profiles")
        .update({ signup_source })
        .eq("id", userId)
        .is("signup_source", null);

      if (error) {
        logger.error({ err: error, userId }, "Failed to save signup source");
        throw new HttpError(500, "Impossible d'enregistrer la source d'inscription.");
      }

      res.status(204).end();
    }),
  );

  // GDPR erasure: the auth user goes, the profile and history follow (ON DELETE CASCADE).
  app.delete(
    "/api/account",
    requireUser,
    asyncRoute(async (_req, res) => {
      await deleteAuthUser(getUserId(res));
      res.status(204).end();
    }),
  );
}
