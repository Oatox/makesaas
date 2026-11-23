import type { Express } from "express";
import type { Server } from "http";
import { registerAccountRoutes } from "./account/routes";
import { registerAcquisitionRoutes } from "./acquisition/routes";
import { registerAdminRoutes } from "./admin/routes";
import { registerApplePayDomainFile } from "./billing/apple-pay";
import { registerBillingRoutes } from "./billing/routes";
import { registerCoachRoutes } from "./coach/routes";
import { registerContentRoutes } from "./content/routes";
import { registerIdeasRoutes } from "./ideas/routes";
import { registerRevenueRoutes } from "./revenue/routes";
import { registerRoadmapRoutes } from "./roadmap/routes";
import { registerSaasRoutes } from "./saas/routes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  registerAccountRoutes(app);
  registerAdminRoutes(app);
  registerBillingRoutes(app);
  registerApplePayDomainFile(app);
  registerSaasRoutes(app);
  registerRevenueRoutes(app);
  registerAcquisitionRoutes(app);
  registerCoachRoutes(app);
  registerContentRoutes(app);
  registerIdeasRoutes(app);
  registerRoadmapRoutes(app);

  return httpServer;
}
