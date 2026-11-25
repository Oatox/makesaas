import type { OnboardingScreenStat } from "@shared/admin";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { cn } from "@/lib/utils";
import { screenName } from "./screen-names";

/** How many of the biggest drops are flagged. */
const FLAGGED_DROPS = 3;

/** The screens that lose the most visitors compared with the screen before (in visitors, not %). */
function biggestDrops(screens: OnboardingScreenStat[]): Map<number, number> {
  const drops = screens
    .map((screen, index) => ({ number: screen.number, lost: index > 0 ? screens[index - 1].users - screen.users : 0 }))
    .filter((drop) => drop.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, FLAGGED_DROPS);
  return new Map(drops.map((drop, rank) => [drop.number, rank + 1]));
}

/**
 * Every screen of the onboarding in order, with the visitors who reached it (a bar against the first
 * screen) and what it lost from the screen before; the biggest drops are flagged, the place to work on.
 */
export function ScreenDropoff({ screens }: { screens: OnboardingScreenStat[] }) {
  const first = screens[0]?.users ?? 0;
  const drops = biggestDrops(screens);

  return (
    <section className="card-3d p-5 sm:p-6" aria-labelledby="onboarding-screens-title">
      <h2 id="onboarding-screens-title" className="text-base font-semibold">
        Écran par écran
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Les visiteurs arrivés à chaque écran. Les {FLAGGED_DROPS} plus grosses chutes sont en rouge : c'est là qu'ils partent.
      </p>

      {screens.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Aucun écran vu sur cette période.</p>
      ) : (
        <ol className="mt-4 divide-y divide-border/50">
          {screens.map((screen, index) => {
            const previous = screens[index - 1];
            const lost = previous ? previous.users - screen.users : 0;
            const rank = drops.get(screen.number);
            const names = screen.stepIds.map(screenName);

            return (
              <li key={screen.number} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {String(screen.number).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                  <p className="flex min-w-0 items-baseline gap-1.5 text-sm" title={names.join(" / ")}>
                    <span className="truncate">{names[0]}</span>
                    {names.length > 1 && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        +{names.length - 1} variante{names.length > 2 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full", rank ? "bg-destructive/80" : "bg-primary/70")}
                      style={{ width: `${first ? Math.min((screen.users / first) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>

                <div className="w-24 text-right">
                  <p className="text-sm font-medium tabular-nums">{formatCount(screen.users)}</p>
                  {lost > 0 && previous && (
                    <p className={cn("text-xs tabular-nums", rank ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      −{formatCount(lost)} ({formatRate(lost / previous.users)})
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
