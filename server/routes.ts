import type { Express } from "express";
import type { Server } from "http";
import { registerAccountRoutes } from "./account/routes";
import { registerAdminRoutes } from "./admin/routes";
import { registerAiRoutes } from "./ai/routes";
import { registerApplePayDomainFile } from "./billing/apple-pay";
import { registerBillingRoutes } from "./billing/routes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  registerAccountRoutes(app);
  registerAdminRoutes(app);
  registerBillingRoutes(app);
  registerApplePayDomainFile(app);
  registerAiRoutes(app);

  return httpServer;
}
