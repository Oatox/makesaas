import type { OnboardingFunnelStep } from "@shared/admin";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { cn } from "@/lib/utils";

/** Thinnest band, in % of the height: a step nobody reached still shows its count. */
const MIN_HEIGHT = 16;

/** Height of a band for a share of the first step's visitors, from 100 % down to MIN_HEIGHT. */
const bandHeight = (share: number) => MIN_HEIGHT + Math.min(Math.max(share, 0), 1) * (100 - MIN_HEIGHT);

/**
 * Each step's band is a trapezoid, centered, from its own height on the left to the next step's on
 * the right: side by side, a funnel lying on its side.
 */
const trapezoid = (left: number, right: number) =>
  `polygon(0 ${50 - left / 2}%, 100% ${50 - right / 2}%, 100% ${50 + right / 2}%, 0 ${50 + left / 2}%)`;

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

/**
 * The funnel from the onboarding's first screen to the subscription, drawn as one and read left to
 * right: each step's band as tall as its share of the visitors who started, its count inside, and
 * under it what it keeps of the start and loses from the step before. The step that loses the most is
 * outlined in red. On a narrow screen the funnel scrolls sideways.
 */
export function OnboardingFunnel({ steps }: { steps: OnboardingFunnelStep[] }) {
  const start = steps[0]?.users ?? 0;
  const shares = steps.map((step) => (start ? step.users / start : 0));
  const worst = biggestLoss(steps);
  const end = steps[steps.length - 1];
  const columns = { gridTemplateColumns: `repeat(${steps.length}, minmax(6.5rem, 1fr))` };

  return (
    <section className="card-3d p-5 sm:p-6" aria-labelledby="onboarding-funnel-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="onboarding-funnel-title" className="text-base font-semibold">
          L'entonnoir
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
        <div className="-mx-5 mt-5 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
          <div className="grid min-w-max gap-x-[3px] sm:min-w-0" style={columns}>
            {steps.map((step, index) => {
              const left = bandHeight(shares[index]);
              const right = bandHeight(shares[index + 1] ?? shares[index]);

              return (
                <div key={step.label} className="relative h-44 sm:h-52" aria-hidden>
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: trapezoid(left, right),
                      // From the brand orange on the left to a deeper shade at the end of the funnel.
                      background: `linear-gradient(90deg, color-mix(in oklab, hsl(var(--primary)), black ${index * 7}%), color-mix(in oklab, hsl(var(--primary)), black ${index * 7 + 6}%))`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-primary-foreground drop-shadow-sm">
                    {formatCount(step.users)}
                  </span>
                </div>
              );
            })}

            {steps.map((step, index) => {
              const previous = steps[index - 1];
              const lost = previous?.users ? 1 - step.users / previous.users : null;
              const isWorst = index === worst;

              return (
                <div
                  key={`${step.label}-text`}
                  className={cn("mt-3 min-w-0 rounded-lg px-2 py-1.5 text-center", isWorst && "bg-destructive/10 ring-1 ring-destructive/40")}
                >
                  <p className="text-sm font-medium leading-snug">{step.label}</p>
                  {/* The count is drawn in the band, hidden from screen readers: read here instead. */}
                  <p className="sr-only">{formatCount(step.users)} visiteurs</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{index === 0 ? "100 %" : `${formatRate(shares[index])} du début`}</p>
                  {lost !== null && lost > 0 && (
                    <p className={cn("text-xs tabular-nums", isWorst ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      −{formatRate(lost)}
                    </p>
                  )}
                  {isWorst && <p className="mt-0.5 text-[11px] font-medium text-destructive">Plus grosse perte</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
