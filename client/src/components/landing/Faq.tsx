import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { FAQS } from "@/config/faq";
import { RevealItem, RevealSection } from "@/components/landing/SectionReveal";

/**
 * Landing FAQ: the visitor's objections as a plain list, no cards, rows split by hairlines. One
 * answer open at a time, the first one open to start. Each row ends with a round "+" that turns
 * into an orange "−" while open.
 */
export function Faq() {
  return (
    <RevealSection id="faq" className="px-4 py-24 md:py-32">
      <div className="mx-auto max-w-4xl">
        <RevealItem className="mb-10 space-y-3 text-center md:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Questions</p>
          <h2 className="landing-title text-balance font-display text-[32px] md:text-[48px]">Ce qu'on nous demande avant de se lancer</h2>
        </RevealItem>

        <RevealItem>
          <AccordionPrimitive.Root type="single" collapsible defaultValue="faq-0" className="border-t border-white/[0.08]">
            {FAQS.map(({ q, a }, i) => (
              <AccordionPrimitive.Item key={q} value={`faq-${i}`} className="group border-b border-white/[0.08]">
                <AccordionPrimitive.Header>
                  <AccordionPrimitive.Trigger className="flex w-full items-center justify-between gap-6 py-5 text-left text-[15px] text-foreground transition-colors hover:text-foreground/80 md:text-base">
                    {q}
                    {/* The "+": its vertical bar folds away when open, leaving a "−" on an orange disc. */}
                    <span
                      aria-hidden
                      className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 transition-colors duration-200 group-data-[state=open]:border-primary group-data-[state=open]:bg-primary"
                    >
                      <span className="absolute h-[1.5px] w-3 rounded-full bg-foreground group-data-[state=open]:bg-primary-foreground" />
                      <span className="absolute h-3 w-[1.5px] rounded-full bg-foreground transition-transform duration-200 group-data-[state=open]:scale-y-0" />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <p className="pb-6 pr-12 leading-relaxed text-muted-foreground">{a}</p>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            ))}
          </AccordionPrimitive.Root>
        </RevealItem>
      </div>
    </RevealSection>
  );
}
