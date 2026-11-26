import { useState } from "react";
import type { AdminOnboardingStats, DeviceCounts } from "@shared/admin";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { cn } from "@/lib/utils";
import { DeviceBreakdown } from "./DeviceBreakdown";
import { screenName } from "./screen-names";

/** How many of the biggest drops are flagged, among those losing at least MIN_FLAGGED_LOSS of the step before. */
const FLAGGED_DROPS = 3;
const MIN_FLAGGED_LOSS = 0.1;

/** A row of the list: the landing page, then each position of the onboarding. */
export type StepRow = { key: string; number: number | null; names: string[]; users: number; devices: DeviceCounts };

function stepRows({ landing, screens }: Pick<AdminOnboardingStats, "landing" | "screens">): StepRow[] {
  return [
    { key: "landing", number: null, names: ["Landing"], users: landing.users, devices: landing.devices },
    ...screens.map((screen) => ({
      key: `screen-${screen.number}`,
      number: screen.number,
      names: screen.stepIds.map(screenName),
      users: screen.users,
      devices: screen.devices,
    })),
  ];
}

/**
 * The rows that lose the most visitors compared with the row before (in visitors, not %): their index
 * → rank. A small share lost is left out, however many visitors: one visitor in ten is noise.
 */
function biggestDrops(rows: StepRow[]): Map<number, number> {
  const drops = rows
    .map((row, index) => ({ index, before: index > 0 ? rows[index - 1].users : 0, lost: index > 0 ? rows[index - 1].users - row.users : 0 }))
    .filter((drop) => drop.lost > 0 && drop.lost / drop.before >= MIN_FLAGGED_LOSS)
    // As many visitors lost: the bigger share first.
    .sort((a, b) => b.lost - a.lost || b.lost / b.before - a.lost / a.before)
    .slice(0, FLAGGED_DROPS);
  return new Map(drops.map((drop, rank) => [drop.index, rank + 1]));
}

function StepLabel({ row }: { row: StepRow }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2 text-sm" title={row.names.join(" / ")}>
      <span className="w-5 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {row.number !== null ? String(row.number).padStart(2, "0") : ""}
      </span>
      <span className="truncate">{row.names[0]}</span>
      {row.names.length > 1 && (
        <span className="shrink-0 text-xs text-muted-foreground">
          +{row.names.length - 1} variante{row.names.length > 2 ? "s" : ""}
        </span>
      )}
    </span>
  );
}

/**
 * The landing page and every screen of the onboarding in order: the visitors who reached it (a bar
 * against the landing page's) and the share of the step before who did; the biggest drops in red. A
 * click on a step opens its figures per kind of device below (on the biggest drop at first).
 */
export function OnboardingSteps(props: Pick<AdminOnboardingStats, "landing" | "screens">) {
  const rows = stepRows(props);
  const drops = biggestDrops(rows);
  const first = rows[0].users || Math.max(...rows.map((row) => row.users), 0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const worst = Array.from(drops).find(([, rank]) => rank === 1)?.[0];
  const found = rows.findIndex((row) => row.key === selectedKey);
  const selected = found >= 0 ? found : (worst ?? Math.min(1, rows.length - 1));

  return (
    <>
      <section className="card-3d p-5 sm:p-6" aria-labelledby="onboarding-steps-title">
        <h2 id="onboarding-steps-title" className="text-base font-semibold">
          Étape par étape
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les visiteurs arrivés à chaque étape, et la part de ceux de l'étape d'avant. Les plus grosses chutes sont en
          rouge. Clique sur une étape pour la voir par appareil.
        </p>

        {props.screens.length === 0 && rows[0].users === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Aucun écran vu sur cette période.</p>
        ) : (
          <ol className="mt-4 space-y-0.5">
            {rows.map((row, index) => {
              const previous = rows[index - 1];
              const isSelected = index === selected;
              const flagged = drops.has(index);

              return (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(row.key)}
                    aria-pressed={isSelected}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-lg px-2 py-2 text-left transition-colors",
                      "sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_5rem] sm:py-2.5",
                      "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "bg-muted/60",
                    )}
                  >
                    <span className="col-start-1 row-start-1 min-w-0">
                      <StepLabel row={row} />
                    </span>
                    <span className="col-span-2 col-start-1 row-start-2 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1 sm:col-start-2 sm:row-start-1">
                      <span
                        className={cn(
                          "block h-full rounded-full transition-colors",
                          isSelected ? "bg-foreground" : "bg-muted-foreground/45",
                        )}
                        style={{ width: `${first ? Math.min((row.users / first) * 100, 100) : 0}%` }}
                      />
                    </span>
                    <span className="col-start-2 row-start-1 text-right sm:col-start-3">
                      <span className="block text-sm font-medium tabular-nums">{formatCount(row.users)}</span>
                      {previous && (
                        <span
                          className={cn(
                            "block text-xs tabular-nums",
                            flagged ? "font-semibold text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {previous.users ? formatRate(row.users / previous.users) : "—"}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {rows[selected] && <DeviceBreakdown row={rows[selected]} previous={rows[selected - 1]} />}
    </>
  );
}
