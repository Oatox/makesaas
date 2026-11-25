import type { OnboardingFunnelStep } from "@shared/admin";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { cn } from "@/lib/utils";

/** Thinnest band, in % of the funnel's breadth: a step nobody reached still shows its count. */
const MIN_BREADTH = 16;

/** Breadth of a band for a share of the first step's visitors, from 100 % down to MIN_BREADTH. */
const bandBreadth = (share: number) => MIN_BREADTH + Math.min(Math.max(share, 0), 1) * (100 - MIN_BREADTH);

/**
 * Each step's band is a trapezoid, centered, from its own breadth to the next step's: side by side
 * (wide screens) or stacked (phones), a funnel.
 */
const horizontalTrapezoid = (left: number, right: number) =>
  `polygon(0 ${50 - left / 2}%, 100% ${50 - right / 2}%, 100% ${50 + right / 2}%, 0 ${50 + left / 2}%)`;
const verticalTrapezoid = (top: number, bottom: number) =>
  `polygon(${50 - top / 2}% 0, ${50 + top / 2}% 0, ${50 + bottom / 2}% 100%, ${50 - bottom / 2}% 100%)`;

/** From the brand orange at the start to a deeper shade at the end of the funnel. */
const bandFill = (index: number, direction: "90deg" | "180deg") =>
  `linear-gradient(${direction}, color-mix(in oklab, hsl(var(--primary)), black ${index * 7}%), color-mix(in oklab, hsl(var(--primary)), black ${index * 7 + 6}%))`;

/** The steps lose visitors from one to the next: the one that loses the most of them (as a share). */
function biggestLoss(steps: OnboardingFunnelStep[]): number | null {
  let worst: number | null = null;
  let worstLost = 0;
  for (let index = 1; index < steps.length; index++) {
    const previous = steps[index - 1].users;
    if (!previous) continue;
    const lost = 1 - steps[index].users / previous;
    if (lost > worstLost) {
      worst = index;
      worstLost = lost;
    }
  }
  return worst;
}

type FunnelProps = { steps: OnboardingFunnelStep[]; shares: number[]; worst: number | null };

/** A step's name, what it keeps of the start and loses from the step before; outlined when it loses the most. */
function StepText({ steps, shares, worst, index, className }: FunnelProps & { index: number; className?: string }) {
  const step = steps[index];
  const previous = steps[index - 1];
  const lost = previous?.users ? 1 - step.users / previous.users : null;
  const isWorst = index === worst;

  return (
    <div className={cn("min-w-0 rounded-lg px-2 py-1.5", isWorst && "bg-destructive/10 ring-1 ring-destructive/40", className)}>
      <p className="text-sm font-medium leading-snug">{step.label}</p>
      {/* The count is drawn in the band, hidden from screen readers: read here instead. */}
      <p className="sr-only">{formatCount(step.users)} visiteurs</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {index === 0 ? "100 %" : `${formatRate(shares[index])} du début`}
        {lost !== null && lost > 0 && (
          <span className={cn("ml-1.5", isWorst ? "font-semibold text-destructive" : "")}>−{formatRate(lost)}</span>
        )}
      </p>
      {isWorst && <p className="mt-0.5 text-[11px] font-medium text-destructive">Plus grosse perte</p>}
    </div>
  );
}

/** The count drawn in a band. */
function BandCount({ users }: { users: number }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-primary-foreground drop-shadow-sm">
      {formatCount(users)}
    </span>
  );
}

/** Wide screens: the funnel lying on its side, read left to right, each step's text under its band. */
function HorizontalFunnel({ steps, shares, worst }: FunnelProps) {
  return (
    <div className="mt-5 grid gap-x-[3px]" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, index) => (
        <div key={step.label} className="relative h-52" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              clipPath: horizontalTrapezoid(bandBreadth(shares[index]), bandBreadth(shares[index + 1] ?? shares[index])),
              background: bandFill(index, "90deg"),
            }}
          />
          <BandCount users={step.users} />
        </div>
      ))}
      {steps.map((step, index) => (
        <StepText key={`${step.label}-text`} steps={steps} shares={shares} worst={worst} index={index} className="mt-3 text-center" />
      ))}
    </div>
  );
}

/** Phones and narrow screens: the funnel standing up, read top to bottom, each step's text beside its band. */
function VerticalFunnel({ steps, shares, worst }: FunnelProps) {
  return (
    <div className="mt-5 space-y-[3px]">
      {steps.map((step, index) => (
        <div key={step.label} className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)] items-center gap-3">
          <div className="relative h-12" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                clipPath: verticalTrapezoid(bandBreadth(shares[index]), bandBreadth(shares[index + 1] ?? shares[index])),
                background: bandFill(index, "180deg"),
              }}
            />
            <BandCount users={step.users} />
          </div>
          <StepText steps={steps} shares={shares} worst={worst} index={index} />
        </div>
      ))}
    </div>
  );
}

/**
 * The funnel from the onboarding's first screen to the subscription, drawn as one: each step's band
 * as broad as its share of the visitors who started, its count inside, and with it what it keeps of
 * the start and loses from the step before. The step that loses the most is outlined in red. Read left
 * to right on wide screens, top to bottom on phones.
 */
export function OnboardingFunnel({ steps }: { steps: OnboardingFunnelStep[] }) {
  const start = steps[0]?.users ?? 0;
  const shares = steps.map((step) => (start ? step.users / start : 0));
  const worst = biggestLoss(steps);
  const end = steps[steps.length - 1];

  return (
    <section className="card-3d p-5 sm:p-6" aria-labelledby="onboarding-funnel-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="onboarding-funnel-title" className="text-base font-semibold">
          Funnel onboarding
        </h2>
        {start > 0 && end && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{formatRate(end.users / start)}</span> des visiteurs
            vont jusqu'à l'abonnement
          </p>
        )}
      </div>

      {start === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Personne n'a encore vu le premier écran de l'onboarding sur cette période.</p>
      ) : (
        <>
          <div className="hidden lg:block">
            <HorizontalFunnel steps={steps} shares={shares} worst={worst} />
          </div>
          <div className="lg:hidden">
            <VerticalFunnel steps={steps} shares={shares} worst={worst} />
          </div>
        </>
      )}
    </section>
  );
}
