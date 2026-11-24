import { FAQS } from "./faq";

// Single source for SEO: public pages, their meta tags, structured data and the sitemap.
// Used at build time by the prerender step (script/build.ts) — not by the running app.

export const SITE = {
  name: "MakeSaaS",
  url: "https://makesaas.app",
  locale: "fr_FR",
  ogImage: "/brand/og-image.png",
  logo: "/brand/icon-512.png",
  themeColor: "#0B0E0D",
  description:
    "MakeSaaS t'aide à lancer ton business : une idée faite pour toi, un plan clair jour après jour et un coach à chaque étape, jusqu'à tes premiers clients.",
};

export type SeoPage = {
  path: string;
  /** Output file in dist/public (served for `path` by server/static.ts). */
  file: string;
  title: string;
  description: string;
  /**
   * Indexed and listed in the sitemap. Without it, the page is still prerendered (visitors, link
   * previews) but kept out of search results with robots "noindex": the legal pages.
   */
  sitemap?: { changefreq: "daily" | "weekly" | "monthly" | "yearly"; priority: number };
};

/** Public pages: prerendered to static HTML; those with `sitemap` are indexed and listed there. */
export const PUBLIC_PAGES: SeoPage[] = [
  {
    path: "/",
    file: "index.html",
    title: "MakeSaaS · Lance ton business",
    description: SITE.description,
    sitemap: { changefreq: "weekly", priority: 1 },
  },
  {
    path: "/mentions-legales",
    file: "mentions-legales.html",
    title: "Mentions légales | MakeSaaS",
    description: "Éditeur, hébergeur et informations légales du site MakeSaaS.",
  },
  {
    path: "/cgu",
    file: "cgu.html",
    title: "Conditions générales d'utilisation | MakeSaaS",
    description: "Conditions d'utilisation du service MakeSaaS.",
  },
  {
    path: "/cgv",
    file: "cgv.html",
    title: "Conditions générales de vente | MakeSaaS",
    description: "Conditions de souscription, de paiement, de résiliation et de remboursement des abonnements MakeSaaS.",
  },
  {
    path: "/confidentialite",
    file: "confidentialite.html",
    title: "Politique de confidentialité | MakeSaaS",
    description: "Comment MakeSaaS collecte, utilise et protège vos données personnelles.",
  },
];

/** Head of the non-indexed app shell (login, app pages, 404...). */
export const APP_SHELL_PAGE = {
  title: "MakeSaaS",
  description: SITE.description,
};

const absolute = (path: string) => `${SITE.url}${path === "/" ? "/" : path}`;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// JSON-LD lives in a <script>: "<" must not be able to close it.
const jsonLd = (data: object) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

function structuredData(page: SeoPage): object[] {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: absolute(SITE.logo),
  };
  if (page.path !== "/") return [organization];

  return [
    organization,
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
      inLanguage: "fr-FR",
      description: SITE.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];
}

/** <head> tags for a public page: title, description, canonical or noindex, Open Graph, X, JSON-LD. */
export function renderHead(page: SeoPage): string {
  const url = absolute(page.path);
  const image = absolute(SITE.ogImage);
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    // A canonical URL on a noindex page would ask search engines for two opposite things.
    page.sitemap ? `<link rel="canonical" href="${url}" />` : `<meta name="robots" content="noindex" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE.name}" />`,
    `<meta property="og:locale" content="${SITE.locale}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Logo MakeSaaS" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...structuredData(page).map(jsonLd),
  ].join("\n    ");
}

/** <head> tags for the app shell: present for link previews, but kept out of the index. */
export function renderAppShellHead(): string {
  return [
    `<title>${APP_SHELL_PAGE.title}</title>`,
    `<meta name="description" content="${escapeHtml(APP_SHELL_PAGE.description)}" />`,
    `<meta name="robots" content="noindex" />`,
  ].join("\n    ");
}

export function renderSitemap(lastmod: string): string {
  const urls = PUBLIC_PAGES.flatMap(({ path, sitemap }) =>
    sitemap
      ? [
          `  <url>\n    <loc>${absolute(path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
            `    <changefreq>${sitemap.changefreq}</changefreq>\n    <priority>${sitemap.priority.toFixed(1)}</priority>\n  </url>`,
        ]
      : [],
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
