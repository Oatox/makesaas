import type { IconType } from "react-icons";
import {
  SiFramer,
  SiGooglegemini,
  SiReact,
  SiShadcnui,
  SiSupabase,
  SiTailwindcss,
  SiTypescript,
  SiVite,
} from "react-icons/si";
import { RevealItem, RevealSection } from "@/components/landing/SectionReveal";

// ⚠️ PLACEHOLDER: the tools your product is built with or works with. Logos come from Simple Icons
// (react-icons/si) and are drawn in the text color; a tool without a logo shows its name alone.
const TOOLS: { name: string; Icon?: IconType }[] = [
  { name: "Supabase", Icon: SiSupabase },
  { name: "Whop" },
  { name: "React", Icon: SiReact },
  { name: "TypeScript", Icon: SiTypescript },
  { name: "Tailwind CSS", Icon: SiTailwindcss },
  { name: "shadcn/ui", Icon: SiShadcnui },
  { name: "Vite", Icon: SiVite },
  { name: "Framer Motion", Icon: SiFramer },
  { name: "Gemini", Icon: SiGooglegemini },
];

/**
 * Landing strip under the hero: a short caption over the tools (logo and name) scrolling in a loop,
 * faded at both ends. Reuses the testimonials marquee (pauses on hover, plain scroll with reduced motion).
 */
export function StackMarquee() {
  return (
    // No bottom padding: the next section (features) brings its own top spacing.
    <RevealSection aria-label="Outils utilisés" className="px-4 pt-10 md:pt-14">
      <RevealItem>
        <p className="text-center text-sm text-muted-foreground">Construit avec les meilleurs outils</p>
      </RevealItem>

      <RevealItem className="marquee mx-auto mt-6 max-w-3xl [mask-image:linear-gradient(to_right,transparent,#000_18%,#000_82%,transparent)]">
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
