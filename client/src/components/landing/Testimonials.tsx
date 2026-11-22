import { Star } from "lucide-react";
import { LandingCta } from "@/components/landing/LandingCta";
import { RevealItem, RevealSection } from "@/components/landing/SectionReveal";

// ⚠️ PLACEHOLDER CONTENT — replace before going live.
// Names, quotes and AI-generated portraits below are illustrative only. Publishing invented
// customer reviews is a misleading commercial practice in France/EU (Code de la consommation
// L121-4, "Omnibus" directive): swap in real testimonials (with consent) before launch.
export const TESTIMONIALS = [
  {
    name: "Yanis K.",
    role: "Fondateur · Lyon",
    quote: "J'ai lancé mon produit en un week-end : l'auth, les paiements et l'admin étaient déjà là. Je n'ai codé que ma fonctionnalité.",
  },
  {
    name: "Camille D.",
    role: "Indie hacker · Paris",
    quote: "Propre, rapide, sans configuration interminable. J'ai branché Supabase et Whop en une heure.",
  },
  {
    name: "Patrick L.",
    role: "Développeur freelance",
    quote: "Je l'utilise comme base pour tous mes projets clients. Le socle est solide et je gagne des jours à chaque fois.",
  },
  {
    name: "Aïcha T.",
    role: "Fondatrice · Marseille",
    quote: "L'onboarding et le paywall convertissent bien dès le premier jour. Je n'aurais jamais pris le temps de les soigner autant.",
  },
  {
    name: "Karim B.",
    role: "CTO · Toulouse",
    quote: "Le pipeline IA éditable depuis l'admin, c'est un vrai plus : on ajuste les prompts sans redéployer.",
  },
  {
    name: "Isabelle M.",
    role: "Product manager · Nantes",
    quote: "On a validé notre idée en quelques jours au lieu de quelques mois. Tout le reste était déjà prêt.",
  },
  {
    name: "Lucas G.",
    role: "Étudiant · Rennes",
    quote: "Parfait pour apprendre : le code est clair et bien commenté. J'ai lancé mon premier SaaS payant.",
  },
  {
    name: "Inès R.",
    role: "Fondatrice · Bordeaux",
    quote: "Les pages légales, le SEO et le partage sur les réseaux étaient déjà en place. Un gain de temps énorme.",
  },
  {
    name: "Bernard C.",
    role: "Entrepreneur · Saint-Étienne",
    quote: "Je ne suis pas un as du code et pourtant j'ai réussi à lancer mon outil. Tout est simple à modifier.",
  },
  {
    name: "Kevin N.",
    role: "Développeur · Lille",
    quote: "Interface soignée, ça tourne aussi bien sur mobile. Je ne démarre plus un projet sans MakeSaaS.",
  },
].map((t, i) => ({ ...t, avatar: `/landing/testimonials/person-${i + 1}.webp` }));

function TestimonialCard({ testimonial: t }: { testimonial: (typeof TESTIMONIALS)[number] }) {
  return (
    <article className="card-3d flex h-full w-[320px] shrink-0 flex-col gap-5 p-6 sm:w-[360px]">
      <div className="flex gap-0.5 text-highlight" aria-label="5 étoiles sur 5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} aria-hidden className="h-4 w-4 fill-current" />
        ))}
      </div>
      <blockquote className="flex-1 text-[15px] leading-relaxed text-foreground/90">« {t.quote} »</blockquote>
      <figure className="flex items-center gap-3">
        <img
          src={t.avatar}
          alt={t.name}
          width={48}
          height={48}
          loading="lazy"
          className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
        />
        <figcaption className="leading-tight">
          <p className="font-semibold">{t.name}</p>
          <p className="text-sm text-muted-foreground">{t.role}</p>
        </figcaption>
      </figure>
    </article>
  );
}

/** Landing section: what users say about the product. */
export function Testimonials() {
  return (
    <RevealSection id="temoignages" className="px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <RevealItem className="mb-12 space-y-4 text-center">
          <h2 className="landing-title font-display text-[32px] md:text-[48px]">
            Ils ont lancé leur SaaS <span className="text-highlight">avec MakeSaaS</span>
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Des fondateurs qui ont gagné des semaines de développement.
          </p>
        </RevealItem>

        {/* Continuous marquee: the list is rendered twice and slides by half its width, so it loops
            seamlessly. Pauses on hover; with reduced motion it becomes a plain horizontal scroll. */}
        <RevealItem
          className="marquee -mx-4 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]"
          aria-label="Témoignages d'utilisateurs"
        >
          <ul className="marquee-track flex w-max py-2">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((testimonial, index) => (
              // Spacing as padding (not gap) so half the track is exactly one full set of cards.
              <li key={index} className="pr-4" aria-hidden={index >= TESTIMONIALS.length}>
                <TestimonialCard testimonial={testimonial} />
              </li>
            ))}
          </ul>
        </RevealItem>

        <RevealItem className="mt-12 flex justify-center">
          <LandingCta label="Rejoindre MakeSaaS" />
        </RevealItem>
      </div>
    </RevealSection>
  );
}
