import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Public pages are prerendered at build time (index.html, cgu.html...): "/cgu" serves cgu.html.
  app.use(express.static(distPath, { extensions: ["html"] }));

  // Everything else is the client-rendered app: serve its noindex shell (spa.html), not the
  // prerendered landing. Falls back to index.html for builds without a prerender step.
  const shell = fs.existsSync(path.resolve(distPath, "spa.html")) ? "spa.html" : "index.html";
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, shell));
  });
}
