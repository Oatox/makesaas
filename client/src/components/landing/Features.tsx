import { CreditCard, LayoutDashboard, Scale, ShieldCheck, Sparkles, Wand2, type LucideIcon } from "lucide-react";
import { RevealItem, RevealSection } from "@/components/landing/SectionReveal";

// ⚠️ PLACEHOLDER: describe your own product here.
const FEATURES: { icon: LucideIcon; title: string; detail: string }[] = [
  {
    icon: ShieldCheck,
    title: "Authentification",
    detail: "Email, mot de passe et Google via Supabase, avec des règles RLS en place sur chaque table.",
  },
  {
    icon: Wand2,
    title: "Onboarding",
    detail: "Un parcours animé de questions, preuve sociale et projection, qui mène à l'inscription puis au paywall.",
  },
  {
    icon: CreditCard,
    title: "Abonnements",
    detail: "Deux offres Whop avec checkout intégré, webhook signé et passage d'une offre à l'autre.",
  },
  {
    icon: LayoutDashboard,
    title: "Administration",
    detail: "Statistiques d'inscription, gestion des utilisateurs, des rôles, des offres et des sessions.",
  },
  {
    icon: Sparkles,
    title: "Pipeline IA",
    detail: "Des prompts modifiables depuis l'admin et une sortie JSON validée par un schéma.",
  },
  {
    icon: Scale,
    title: "Légal et SEO",
    detail: "Mentions légales, CGU, CGV, confidentialité, pages prérendues, sitemap et image de partage.",
  },
];

/** Landing section: what the product does, as a grid of cards. */
export function Features() {
  return (
    <RevealSection id="features" className="px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <RevealItem className="mb-12 space-y-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl">
            Tout le socle, <span className="text-highlight">déjà prêt</span>
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Ce que chaque SaaS doit avoir avant même sa première fonctionnalité.
          </p>
        </RevealItem>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, detail }) => (
            <RevealItem key={title} className="card-3d space-y-3 p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
                <Icon className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="leading-relaxed text-muted-foreground">{detail}</p>
            </RevealItem>
          ))}
        </div>
      </div>
    </RevealSection>
  );
}
