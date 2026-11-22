// Load .env in development only. In production (Railway...) secrets are injected
// as real env vars. The previous createRequire(import.meta.url) crashed the CJS
// bundle because import.meta.url is undefined there.
if (process.env.NODE_ENV !== "production") {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file: rely on the environment
  }
}
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { logger } from "./lib/logger";
import { HttpError } from "./lib/http";
import pinoHttp from "pino-http";

const app = express();
const httpServer = createServer(app);

// rawBody keeps the exact bytes received: signed webhooks (Whop) are verified on them.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

app.use(
  pinoHttp({
    logger,
    // Filter out asset requests from logs to keep them clean
    autoLogging: {
      ignore: (req) => {
        const url = req.url || "";
        return (
          url.startsWith("/@") || 
          url.includes(".") || 
          url.startsWith("/src/") ||
          url.startsWith("/node_modules/")
        );
      },
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
      }),
    },
  })
);

(async () => {
  await registerRoutes(httpServer, app);

  // Unknown API routes get a JSON 404, not the SPA shell served below.
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Route introuvable." });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      if (err.status >= 500) logger.error({ err }, err.message);
      return res.status(err.status).json({ message: err.message, details: err.details });
    }

    // Body-parser errors (malformed JSON, payload too large) carry a 4xx status and a safe message.
    const status = (err as { status?: number })?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      return res.status(status).json({ message: "Requête invalide." });
    }

    logger.error({ err }, "Unhandled error");
    res.status(500).json({ message: "Une erreur inattendue est survenue." });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info(`serving on port ${port}`);
    },
  );
})();
