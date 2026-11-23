import type { ComponentType, SVGProps } from "react";
import { SiFramer, SiGithub, SiStripe, SiSupabase, SiVercel } from "react-icons/si";
import { RevealItem, RevealSection } from "@/components/landing/SectionReveal";

type LogoIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

/** Cursor's logo (Simple Icons, CC0): not in the installed react-icons yet. */
function SiCursor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  );
}

/** Whop's logo (from svgl, Whop's official mark): not in Simple Icons. Wide, so it fits the square box by width. */
function SiWhop(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 383.2 196.4" fill="currentColor" {...props}>
      <path d="M60.9,0C35.7,0,18.4,11.1,5.2,23.5c0,0-5.3,5-5.2,5.2l55.2,55.2l55.2-55.2C99.9,14.3,80.2,0,60.9,0z" />
      <path d="M197.2,0c-25.2,0-42.5,11.1-55.7,23.5c0,0-4.8,4.9-5.1,5.2L68.2,96.9l55.1,55.1L246.6,28.7C236.1,14.3,216.5,0,197.2,0z" />
      <path d="M333.8,0c-25.2,0-42.5,11.1-55.7,23.5c0,0-5,4.9-5.2,5.2L136.4,165.2l14.4,14.4c22.3,22.3,58.9,22.3,81.3,0L383,28.7h0.2C372.8,14.3,353.1,0,333.8,0z" />
    </svg>
  );
}

// ⚠️ PLACEHOLDER: the tools the member's plan helps them use. Logos come from Simple Icons
// (react-icons/si, or drawn here when missing) in the text color; a tool without a logo shows its
// name alone.
const TOOLS: { name: string; Icon?: LogoIcon }[] = [
  { name: "Cursor", Icon: SiCursor },
  { name: "Whop", Icon: SiWhop },
  { name: "Stripe", Icon: SiStripe },
  { name: "Supabase", Icon: SiSupabase },
  { name: "GitHub", Icon: SiGithub },
  { name: "Vercel", Icon: SiVercel },
  { name: "Framer", Icon: SiFramer },
];

/**
 * Strip at the bottom of the landing hero: a short caption over the tools (logo and name) scrolling
 * in a loop, faded at both ends. Reuses the testimonials marquee (pauses on hover, plain scroll with
 * reduced motion). No padding: the hero places it.
 */
export function StackMarquee() {
  return (
    <RevealSection aria-label="Outils utilisés" className="shrink-0">
      <RevealItem>
        <p className="text-center text-sm text-muted-foreground">Ton plan t'aide à utiliser</p>
      </RevealItem>

      <RevealItem className="marquee mx-auto mt-4 max-w-3xl md:mt-5 [mask-image:linear-gradient(to_right,transparent,#000_18%,#000_82%,transparent)]">
        {/* Rendered twice: the track slides by half its width, so the loop is seamless. Spacing as
            padding (not gap) so half the track is exactly one full set of tools. */}
        <ul className="marquee-track flex w-max items-center [--marquee-duration:35s]">
          {[...TOOLS, ...TOOLS].map(({ name, Icon }, index) => (
            <li
              key={index}
              aria-hidden={index >= TOOLS.length}
              className="flex items-center gap-2.5 whitespace-nowrap pr-10 text-lg font-semibold text-foreground/45 md:pr-12 md:text-xl"
            >
              {Icon && <Icon aria-hidden className="size-6 shrink-0 md:size-7" />}
              {name}
            </li>
          ))}
        </ul>
      </RevealItem>
    </RevealSection>
  );
}
