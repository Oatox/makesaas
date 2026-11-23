import type { Express } from "express";
import { ideasApi, nextIdeasBodySchema, type NextIdeasResult } from "@shared/ideas";
import { getUserId, requireSubscriber } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { getIdeasService } from "./service";

/**
 * SaaS ideas proposed on /lancement (server/ideas/service.ts). A new member's first ideas are started
 * by the Whop webhook (server/billing/routes.ts); this route shows the next ones (from stock, or from
 * a new request), or the first ones when the webhook could not.
 */
export function registerIdeasRoutes(app: Express) {
  const ideas = getIdeasService();

  // The next series: from stock at once, or once a new request has written it (about a minute). The
  // ideas are kept even if the member leaves: the page reads them from Supabase.
  app.post(
    ideasApi.next.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      if (!ideas) throw new HttpError(503, "Gus ne peut pas proposer d'idées sur ce serveur pour le moment.");
      const body = parseInput(nextIdeasBodySchema, req.body);
      const answer: NextIdeasResult = await ideas.next(getUserId(res), body);
      res.json(answer);
    }),
  );
}
