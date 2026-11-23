import type { CSSProperties, ReactNode, SVGProps } from "react";
import { SiStripe } from "react-icons/si";
import { REVENUE_PROVIDER_NAMES, type RevenueProvider } from "@shared/revenue";
import { cn } from "@/lib/utils";

/** Whop's logo (from svgl, Whop's official mark): not in Simple Icons. */
function WhopLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 383.2 196.4" fill="currentColor" {...props}>
      <path d="M60.9,0C35.7,0,18.4,11.1,5.2,23.5c0,0-5.3,5-5.2,5.2l55.2,55.2l55.2-55.2C99.9,14.3,80.2,0,60.9,0z" />
      <path d="M197.2,0c-25.2,0-42.5,11.1-55.7,23.5c0,0-4.8,4.9-5.1,5.2L68.2,96.9l55.1,55.1L246.6,28.7C236.1,14.3,216.5,0,197.2,0z" />
      <path d="M333.8,0c-25.2,0-42.5,11.1-55.7,23.5c0,0-5,4.9-5.2,5.2L136.4,165.2l14.4,14.4c22.3,22.3,58.9,22.3,81.3,0L383,28.7h0.2C372.8,14.3,353.1,0,333.8,0z" />
    </svg>
  );
}

type ProviderInfo = {
  name: string;
  /** Brand color of the logo tile. */
  color: string;
  logo: (props: { className?: string }) => ReactNode;
  /** One line on the connect buttons. */
  tagline: string;
  keyLabel: string;
  keyPlaceholder: string;
  /** Where the member creates the key. */
  keyUrl: string;
  /** How to create a read-only key, step by step. */
  steps: ReactNode[];
};

// Prefilled restricted key: read access to charges and subscriptions only.
const STRIPE_KEY_URL =
  "https://dashboard.stripe.com/apikeys/create?name=MakeSaaS&permissions%5B%5D=rak_charge_read&permissions%5B%5D=rak_subscription_read";

export const PROVIDERS: Record<RevenueProvider, ProviderInfo> = {
  stripe: {
    name: REVENUE_PROVIDER_NAMES.stripe,
    color: "#635bff",
    logo: ({ className }) => <SiStripe className={className} />,
    tagline: "Clé restreinte en lecture seule",
    keyLabel: "Clé restreinte Stripe",
    keyPlaceholder: "rk_live_…",
    keyUrl: STRIPE_KEY_URL,
    steps: [
      <>Ouvre Stripe → Développeurs → Clés API → <strong>Créer une clé restreinte</strong>.</>,
      <>Mets <strong>Charges</strong> et <strong>Subscriptions</strong> en « Lecture », laisse le reste sur « Aucun ».</>,
      <>Copie la clé (<code>rk_live_…</code>, ou <code>rk_test_…</code> pour essayer en mode test) et colle-la ici.</>,
    ],
  },
  whop: {
    name: REVENUE_PROVIDER_NAMES.whop,
    color: "#fa4616",
    logo: ({ className }) => <WhopLogo className={className} />,
    tagline: "Clé API de ton entreprise",
    keyLabel: "Clé API Whop",
    keyPlaceholder: "Ta clé API Whop",
    keyUrl: "https://whop.com/dashboard",
    steps: [
      <>Ouvre ton tableau de bord Whop → <strong>Développeur</strong> → <strong>Créer une clé API</strong>.</>,
      <>
        Donne-lui uniquement des permissions de <strong>lecture</strong> : <code>payment:basic:read</code>,{" "}
        <code>member:basic:read</code> et la lecture des plans.
      </>,
      <>Copie la clé et colle-la ici (une clé du sandbox Whop fonctionne aussi).</>,
    ],
  },
};

const tileStyle = (color: string): CSSProperties => ({
  backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${color}, white 18%), ${color})`,
  boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.35), inset 0 -2px 0 color-mix(in oklab, ${color}, black 30%)`,
});

/** The provider's logo, white on a tile of its brand color. Size and corners by `className`. */
export function ProviderTile({ provider, className }: { provider: RevenueProvider; className?: string }) {
  const { color, logo: Logo, name } = PROVIDERS[provider];
  return (
    <span
      role="img"
      aria-label={name}
      className={cn("flex shrink-0 items-center justify-center text-white", className ?? "h-10 w-10 rounded-[11px]")}
      style={tileStyle(color)}
    >
      <Logo className={provider === "whop" ? "w-[58%]" : "h-[52%] w-[52%]"} />
    </span>
  );
}
