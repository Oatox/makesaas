import { useId } from "react";
import type { OnboardingFunnelStep } from "@shared/admin";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { cn } from "@/lib/utils";

/** The shape's drawing space (the SVG stretches it to its box): along the flow, and across it. */
const LENGTH = 1000;
const BREADTH = 200;
/** The band's half-breadth at 100 %, leaving room for the halo around it. */
const MAX_HALF = (BREADTH / 2) * 0.8;
/** Thinnest band, as a share of the start: a step nobody reached still shows. */
const MIN_SHARE = 0.035;

/** The layers, from the outside in: how much broader than the band, and how opaque. */
const LAYERS = [
  { scale: 1.22, pad: 3, opacity: 0.16 },
  { scale: 1.1, pad: 1.5, opacity: 0.34 },
  { scale: 1, pad: 0, opacity: 1 },
];

/** The lines between the steps: the card's own color, cutting through the shape. */
const SEPARATOR = "hsl(160 7% 10%)";

const formatCompact = (value: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/**
 * The outline of one layer: in each step's section, the band narrows from that step's breadth to the
 * next one's in a smooth curve, then runs flat to the next section; the last one stays flat. Drawn
 * along x (wide screens) or along y (phones), centered across.
 */
// At most as broad as the start: more visitors can start the onboarding than saw the landing page
// (a link straight to /onboarding), their share still shows on the pill.
const layerHalf = (share: number, scale: number, pad: number) => Math.min(Math.max(share, MIN_SHARE), 1) * MAX_HALF * scale + pad;

function layerPath(shares: number[], scale: number, pad: number, vertical: boolean): string {
  const section = LENGTH / shares.length;
  const half = (share: number) => layerHalf(share, scale, pad);
  const at = (along: number, offset: number) =>
    vertical ? `${BREADTH / 2 + offset},${along}` : `${along},${BREADTH / 2 + offset}`;

  const sections = shares.map((share, index) => ({
    start: index * section,
    from: half(share),
    to: half(shares[index + 1] ?? share),
  }));

  const commands = [`M${at(0, -sections[0].from)}`];
  for (const { start, from, to } of sections) {
    commands.push(
      `C${at(start + 0.15 * section, -from)} ${at(start + 0.4 * section, -to)} ${at(start + 0.85 * section, -to)}`,
      `L${at(start + section, -to)}`,
    );
  }
  for (const { start, from, to } of [...sections].reverse()) {
    commands.push(
      `L${at(start + section, to)}`,
      `L${at(start + 0.85 * section, to)}`,
      `C${at(start + 0.4 * section, to)} ${at(start + 0.15 * section, from)} ${at(start, from)}`,
    );
  }
  return `${commands.join(" ")} Z`;
}

/** The funnel's shape, filling its box: the band and its halo, and the lines between the steps. */
function FunnelShape({ shares, vertical }: { shares: number[]; vertical: boolean }) {
  const gradient = useId();
  const section = LENGTH / shares.length;

  return (
    <svg
      viewBox={vertical ? `0 0 ${BREADTH} ${LENGTH}` : `0 0 ${LENGTH} ${BREADTH}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        {/* From the brand orange at the start to a deeper shade at the end. */}
        <linearGradient id={gradient} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
          <stop offset="0" style={{ stopColor: "hsl(var(--primary))" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in oklab, hsl(var(--primary)), black 22%)" }} />
        </linearGradient>
      </defs>
      {LAYERS.map((layer) => (
        <path key={layer.scale} d={layerPath(shares, layer.scale, layer.pad, vertical)} fill={`url(#${gradient})`} opacity={layer.opacity} />
      ))}
      {shares.slice(1).map((share, index) => {
        const along = (index + 1) * section;
        // Across the shape only, as broad as its halo there (the step's own breadth).
        const outer = LAYERS[0];
        const reach = layerHalf(share, outer.scale, outer.pad) + 1;
        const [from, to] = [BREADTH / 2 - reach, BREADTH / 2 + reach];
        return (
          <line
            key={along}
            x1={vertical ? from : along}
            x2={vertical ? to : along}
            y1={vertical ? along : from}
            y2={vertical ? along : to}
            stroke={SEPARATOR}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/** A step's share of the start, on the band. */
function SharePill({ share }: { share: number }) {
  return (
    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.35)]">
      {formatRate(share)}
    </span>
  );
}

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

/** A step's name and what it loses from the step before; outlined when it loses the most. */
function StepText({
  steps,
  shares,
  worst,
  index,
  withCount,
  className,
}: FunnelProps & { index: number; withCount?: boolean; className?: string }) {
  const step = steps[index];
  const previous = steps[index - 1];
  const lost = previous?.users ? 1 - step.users / previous.users : null;
  const isWorst = index === worst;

  return (
    <div className={cn("min-w-0 rounded-lg px-2 py-1.5", isWorst && "bg-destructive/10 ring-1 ring-destructive/40", className)}>
      <p className="text-sm font-medium leading-snug">{step.label}</p>
      {/* The figures are drawn over the shape, hidden from screen readers: read here instead. */}
      <p className="sr-only">
        {formatCount(step.users)} visiteurs, {formatRate(shares[index])} du début
      </p>
      {(withCount || (lost !== null && lost > 0)) && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {withCount && <span>{formatCount(step.users)} visiteurs</span>}
          {lost !== null && lost > 0 && (
            <span className={cn(withCount && "ml-1.5", isWorst && "font-semibold text-destructive")}>−{formatRate(lost)}</span>
          )}
        </p>
      )}
      {isWorst && <p className="mt-0.5 text-[11px] font-medium text-destructive">Plus grosse perte</p>}
    </div>
  );
}

/** Wide screens: the funnel lying on its side, read left to right, the counts above and each step's text under it. */
function HorizontalFunnel({ steps, shares, worst }: FunnelProps) {
  const columns = { gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` };

  return (
    <div className="mt-6">
      <div className="grid" style={columns} aria-hidden>
        {steps.map((step) => (
          <p key={step.label} className="text-center text-lg font-semibold tabular-nums">
            {formatCompact(step.users)}
          </p>
        ))}
      </div>
      <div className="relative mt-2 h-52" aria-hidden>
        <FunnelShape shares={shares} vertical={false} />
        <div className="absolute inset-0 grid" style={columns}>
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center justify-center">
              <SharePill share={shares[index]} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-x-1" style={columns}>
        {steps.map((step, index) => (
          <StepText key={step.label} steps={steps} shares={shares} worst={worst} index={index} className="text-center" />
        ))}
      </div>
    </div>
  );
}

/** Phones and narrow screens: the funnel standing up, read top to bottom, each step's text beside it. */
function VerticalFunnel({ steps, shares, worst }: FunnelProps) {
  const rows = { gridTemplateRows: `repeat(${steps.length}, 4.75rem)` };

  return (
    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)] gap-x-3" style={rows}>
      <div className="relative" style={{ gridRow: `1 / span ${steps.length}` }} aria-hidden>
        <FunnelShape shares={shares} vertical />
        <div className="absolute inset-0 grid" style={rows}>
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center justify-center">
              <SharePill share={shares[index]} />
            </div>
          ))}
        </div>
      </div>
      {steps.map((step, index) => (
        <div key={step.label} className="col-start-2 flex items-center" style={{ gridRow: index + 1 }}>
          <StepText steps={steps} shares={shares} worst={worst} index={index} withCount />
        </div>
      ))}
    </div>
  );
}

/**
 * The funnel from the landing page to the subscription, drawn as one smooth shape: each step's
 * section as broad as its share of the landing page's visitors (on it), narrowing to the next one's,
 * its count above, and under it what it loses from the step before. The step that loses the most is
 * outlined in red. Read left to right on wide screens, top to bottom on phones.
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
        <p className="mt-4 text-sm text-muted-foreground">Personne n'a encore vu la landing sur cette période.</p>
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
