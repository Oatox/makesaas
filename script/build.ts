import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "pg",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  // Local builds: expose .env to Vite (its root is client/, so it would not find the file) and to the
  // prerender step. On Railway the variables are real environment variables and there is no .env.
  if (existsSync(".env")) process.loadEnvFile(".env");

  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("prerendering public pages...");
  await prerender();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

/**
 * SEO: render the public pages (landing, legal pages) to static HTML with their own meta tags,
 * structured data and sitemap, all from client/src/config/seo.ts. The app itself keeps a
 * client-rendered, noindex shell (spa.html). server/static.ts serves these files.
 */
async function prerender() {
  const ssrOutDir = path.resolve("dist/prerender");
  await viteBuild({
    logLevel: "warn",
    build: {
      ssr: path.resolve("client/src/entry-prerender.tsx"),
      outDir: ssrOutDir,
      emptyOutDir: true,
      // Not part of the client build: never let it wipe dist/public.
      copyPublicDir: false,
    },
    // Bundle every dependency so the render runs with a single React copy and no ESM/CJS surprises.
    ssr: { noExternal: true },
  });

  const entry = await import(pathToFileURL(path.join(ssrOutDir, "entry-prerender.js")).href);
  const publicDir = path.resolve("dist/public");
  const shell = await readFile(path.join(publicDir, "index.html"), "utf-8");
  if (!shell.includes("<!--seo-head-->")) throw new Error("client/index.html lost its <!--seo-head--> marker");

  const withHead = (head: string) => shell.replace(/<!--seo-head-->\s*<title>[^<]*<\/title>/, head);

  for (const page of entry.PUBLIC_PAGES) {
    const html = withHead(entry.renderHead(page)).replace(
      '<div id="root"></div>',
      `<div id="root">${entry.renderPage(page.path)}</div>`,
    );
    await writeFile(path.join(publicDir, page.file), html);
    console.log(`  ${page.path} -> ${page.file}`);
  }

  await writeFile(path.join(publicDir, "spa.html"), withHead(entry.renderAppShellHead()));
  await writeFile(path.join(publicDir, "sitemap.xml"), entry.renderSitemap(new Date().toISOString().slice(0, 10)));
  await rm(ssrOutDir, { recursive: true, force: true });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
