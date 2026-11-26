import { DEVICE_KINDS, type DeviceKind } from "@shared/admin";
import { formatCount, formatRate } from "@/components/revenue/stats";
import { cn } from "@/lib/utils";
import type { StepRow } from "./OnboardingSteps";

const DEVICES: Record<DeviceKind, { label: string; hint?: string }> = {
  desktop: { label: "Ordinateur" },
  tablet: { label: "Tablette" },
  "in-app": { label: "Navigateur d'une app", hint: "TikTok, Instagram, Google…" },
  mobile: { label: "Navigateur mobile", hint: "Safari, Chrome…" },
};

type DeviceLine = { kind: DeviceKind; users: number; rate: number | null };

/**
 * A step of the list per kind of device: the visitors who reached it and the share of those of the
 * step before who did, a tick at the share over all devices; the device far below it is flagged. For
 * the landing page, which has no step before, the share of its visitors each kind of device brings.
 */
export function DeviceBreakdown({ row, previous }: { row: StepRow; previous?: StepRow }) {
  const total = DEVICE_KINDS.reduce((sum, kind) => sum + row.devices[kind], 0);
  const lines: DeviceLine[] = DEVICE_KINDS.map((kind) => {
    const users = row.devices[kind];
    if (!previous) return { kind, users, rate: total ? users / total : null };
    const before = previous.devices[kind];
    return { kind, users, rate: before ? users / before : null };
  }).filter((line) => line.users > 0 || (previous?.devices[line.kind] ?? 0) > 0);

  const average = previous?.users ? row.users / previous.users : null;
  const compared = lines.filter((line) => line.rate !== null);
  const lowest = compared.reduce<DeviceLine | null>((low, line) => (!low || line.rate! < low.rate! ? line : low), null);
  const gap = average !== null && compared.length > 1 && lowest && lowest.rate! < average ? lowest.kind : null;

  return (
    <section className="card-3d p-5 sm:p-6" aria-labelledby="onboarding-devices-title">
      <h2 id="onboarding-devices-title" className="text-base font-semibold">
        Par appareil · <span className="text-muted-foreground">{row.names[0]}</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {previous
          ? "Les visiteurs arrivés à cette étape, et la part de ceux de l'étape d'avant qui y sont arrivés. Le trait orange marque la part sur tous les appareils."
          : "Les visiteurs de la landing, et la part de chaque appareil."}
      </p>

      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Pas de chiffres par appareil pour cette étape.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/50">
          {lines.map((line) => {
            const device = DEVICES[line.kind];
            const isGap = line.kind === gap;

            return (
              <li
                key={line.kind}
                className="grid grid-cols-[minmax(0,1fr)_3.5rem_7rem] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_5rem_11rem]"
              >
                <div className="min-w-0">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                    <span>{device.label}</span>
                    {isGap && (
                      <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive ring-1 ring-destructive/30">
                        Plus gros écart
                      </span>
                    )}
                  </p>
                  {device.hint && <p className="truncate text-xs text-muted-foreground">{device.hint}</p>}
                </div>

                <p className="text-right text-sm tabular-nums">{formatCount(line.users)}</p>

                <div>
                  <p className={cn("text-right text-xs tabular-nums", isGap ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {line.rate !== null ? formatRate(line.rate) : "—"}
                  </p>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${line.rate !== null ? Math.min(line.rate, 1) * 100 : 0}%` }}
                    />
                    {average !== null && (
                      <span
                        className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                        style={{ left: `${Math.min(average, 1) * 100}%` }}
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
