import { Link } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { revealItem } from "@/components/landing/SectionReveal";

// Landing sections are in-page anchors; legal pages are real routes.
const COLUMNS = [
  {
    title: "MakeSaaS",
    links: [
      { label: "Fonctionnalités", href: "#features" },
      { label: "FAQ", href: "#faq" },
      { label: "Commencer", href: "/onboarding", route: true },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales", route: true },
      { label: "Confidentialité", href: "/confidentialite", route: true },
      { label: "Conditions d'utilisation", href: "/cgu", route: true },
      { label: "Conditions de vente", href: "/cgv", route: true },
    ],
  },
];

const linkClass = "text-sm text-muted-foreground transition-colors hover:text-foreground md:text-base";

export function LandingFooter() {
  return (
    <footer className="px-4 pb-6">
      <motion.div
        variants={revealItem}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="mx-auto max-w-6xl rounded-3xl border border-border/60 bg-card/60 px-6 py-8 backdrop-blur-sm sm:px-12 sm:py-12">
        {/* Mobile: brand on top, the two link columns side by side below it. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.6fr_1fr_1fr] md:gap-10">
          <div className="col-span-2 space-y-4 md:col-span-1 md:space-y-5">
            <a href="#hero" className="inline-block transition-opacity hover:opacity-80">
              <Logo className="h-5 md:h-6" />
            </a>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              MakeSaaS t'aide à lancer ton business : une idée faite pour toi, un plan clair jour après jour et un
              coach à chaque étape, jusqu'à tes premiers clients.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="space-y-3 md:space-y-4">
              <h3 className="font-display font-normal text-base text-foreground md:text-lg">{col.title}</h3>
              <ul className="space-y-2.5 md:space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.route ? (
                      <Link href={l.href} className={linkClass}>{l.label}</Link>
                    ) : (
                      <a href={l.href} className={linkClass}>{l.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 border-t border-border/60 pt-5 text-center text-xs text-muted-foreground md:mt-10 md:pt-6 md:text-left md:text-sm">
          <p>© {new Date().getFullYear()} MakeSaaS. Tous droits réservés.</p>
        </div>
      </motion.div>
    </footer>
  );
}
