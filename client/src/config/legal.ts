// Single source for the legal identity shown on the legal pages (mentions légales, CGU, CGV,
// confidentialité). The editor's postal address is deliberately not published here.
// ⚠️ Check every field (support email, host, date) before going live.
export const LEGAL = {
  siteName: "MakeSaaS",
  domain: "makesaas.app",
  editorName: "GUS",
  editorStatus: "Entrepreneur individuel (micro-entreprise)",
  siret: "100 452 200 00015",
  supportEmail: "support@makesaas.app",
  host: {
    name: "Railway Corporation",
    website: "railway.com",
    address: "548 Market Street, San Francisco, CA 94104, États-Unis",
  },
  /** Date shown as "Dernière mise à jour" on every legal page. */
  updatedAt: "22 novembre 2026",
} as const;
