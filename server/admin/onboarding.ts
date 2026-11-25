import { z } from "zod";
import { ANALYTICS_EVENTS, ONBOARDING_FUNNEL } from "@shared/analytics";
import type { AdminOnboardingStats, OnboardingFunnelStep, OnboardingScreenStat, OnboardingStatsPeriod } from "@shared/admin";
import { AMPLITUDE_QUERY_URL } from "../lib/analytics";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";

/**
 * The admin's Onboarding page (/admin/onboarding): the funnel from the onboarding's first screen to
 * the subscription, and the visitors who reach each screen, read from Amplitude's Dashboard REST API
 * with the project's keys (VITE_AMPLITUDE_API_KEY and the server-only AMPLITUDE_SECRET_KEY).
 * Kept a few minutes per period: each query counts against Amplitude's rate limit.
 */

const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 20_000;
/** As in Amplitude's chart: a visitor has 30 days to go from the first screen to the subscription. */
const CONVERSION_WINDOW_SECONDS = 30 * 24 * 60 * 60;

const NOT_CONFIGURED =
  "Amplitude n'est pas relié à l'admin : ajoute AMPLITUDE_SECRET_KEY (Amplitude → Settings → Projects → Secret Key) dans l'environnement du serveur.";

const cache = new Map<OnboardingStatsPeriod, { at: number; stats: AdminOnboardingStats }>();

type EventFilter = { subprop_type: "event"; subprop_key: string; subprop_op: string; subprop_value: string[] };
type QueryEvent = { event_type: string; filters?: EventFilter[]; group_by?: { type: "event"; value: string }[] };

const eventFilter = (key: string, op: string, value: string): EventFilter => ({
  subprop_type: "event",
  subprop_key: key,
  subprop_op: op,
  subprop_value: [value],
});

/**
 * Amplitude answers a query it has already computed from its own cache, for up to 2 hours, even as new
 * events arrive: the page stayed on the visitors of the morning. Each computation adds to the onboarding
 * screen's event a filter that keeps all of them (no `step` label is that) but makes the query a new one,
 * so that Amplitude computes it again. The cache above (CACHE_MS) still spares its rate limit.
 */
const freshnessFilter = (now: number) => eventFilter("step", "is not", `fresh-${now}`);

/** The period's first and last days, as Amplitude takes them (YYYYMMDD, in the project's time zone, UTC). */
export function periodRange(days: number, now = new Date()) {
  const ymd = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
  return { start: ymd(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)), end: ymd(now) };
}

function authorization(): string | null {
  // Trimmed: a space pasted with a key makes Amplitude refuse the pair.
  const apiKey = process.env.VITE_AMPLITUDE_API_KEY?.trim();
  const secretKey = process.env.AMPLITUDE_SECRET_KEY?.trim();
  return apiKey && secretKey ? `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}` : null;
}

async function queryAmplitude(path: string, params: [string, string][]): Promise<unknown> {
  const auth = authorization();
  if (!auth) throw new HttpError(503, NOT_CONFIGURED);

  const url = new URL(`${AMPLITUDE_QUERY_URL}${path}`);
  for (const [name, value] of params) url.searchParams.append(name, value);

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    logger.warn({ err, path }, "Amplitude query failed");
    throw new HttpError(502, "Amplitude ne répond pas. Réessaie dans un instant.");
  }

  if (!res.ok) {
    logger.warn({ status: res.status, path, body: (await res.text()).slice(0, 300) }, "Amplitude rejected a query");
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(502, "Amplitude refuse l'accès : vérifie AMPLITUDE_SECRET_KEY, la Secret Key du même projet que VITE_AMPLITUDE_API_KEY.");
    }
    if (res.status === 429) throw new HttpError(503, "Trop de requêtes vers Amplitude. Réessaie dans une minute.");
    throw new HttpError(502, "Amplitude n'a pas pu calculer les chiffres.");
  }
  return res.json();
}

const funnelResponseSchema = z.object({
  data: z.array(z.object({ cumulativeRaw: z.array(z.number()) })),
});

/** Each funnel step and its visitors, from Amplitude's funnel answer (`cumulativeRaw`: users per step). */
export function readFunnel(body: unknown): OnboardingFunnelStep[] {
  const counts = funnelResponseSchema.parse(body).data[0]?.cumulativeRaw ?? [];
  return ONBOARDING_FUNNEL.map((step, index) => ({ label: step.label, users: counts[index] ?? 0 }));
}

const segmentationResponseSchema = z.object({
  data: z.object({
    // One label per group: the value itself, or [event index, value] when the group-by is on the event.
    seriesLabels: z.array(z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])),
    seriesCollapsed: z.array(z.array(z.object({ value: z.number() }))),
  }),
});

/**
 * Visitors per position in the onboarding, from the screens grouped by their `step` label ("04
 * social-proof"): screens at the same position (the branches after "experience") add up, as each
 * visitor sees one of them. Labels in another shape ("(none)": events sent before the label) are left out.
 */
export function readScreens(body: unknown): OnboardingScreenStat[] {
  const { seriesLabels, seriesCollapsed } = segmentationResponseSchema.parse(body).data;
  const byNumber = new Map<number, OnboardingScreenStat>();

  seriesLabels.forEach((raw, index) => {
    const label = String(Array.isArray(raw) ? raw[raw.length - 1] : raw).trim();
    const match = /^(\d+) (\S+)$/.exec(label);
    if (!match) return;
    const number = Number(match[1]);
    const users = seriesCollapsed[index]?.[0]?.value ?? 0;
    const screen = byNumber.get(number) ?? { number, stepIds: [], users: 0 };
    screen.stepIds.push(match[2]);
    screen.users += users;
    byNumber.set(number, screen);
  });

  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

/** The two queries of the page: the funnel, and the visitors of each screen. */
export function statsQueries(days: OnboardingStatsPeriod, now = new Date()) {
  const { start, end } = periodRange(days, now);
  const fresh = freshnessFilter(now.getTime());

  const funnelEvents: QueryEvent[] = ONBOARDING_FUNNEL.map((step, index) => ({
    event_type: step.event,
    filters: index === 0 ? [eventFilter("step_number", "is", "1"), fresh] : [],
  }));
  const screensEvent: QueryEvent = {
    event_type: ANALYTICS_EVENTS.onboardingStepViewed,
    filters: [eventFilter("step", "is not", "(none)"), fresh],
    group_by: [{ type: "event", value: "step" }],
  };

  const funnel: [string, string][] = [
    ...funnelEvents.map((event): [string, string] => ["e", JSON.stringify(event)]),
    ["start", start],
    ["end", end],
    ["mode", "ordered"],
    ["n", "active"],
    ["cs", String(CONVERSION_WINDOW_SECONDS)],
  ];
  const screens: [string, string][] = [
    ["e", JSON.stringify(screensEvent)],
    ["m", "uniques"],
    ["start", start],
    ["end", end],
    ["i", "30"],
    ["limit", "200"],
  ];
  return { funnel, screens };
}

async function computeStats(days: OnboardingStatsPeriod): Promise<AdminOnboardingStats> {
  const queries = statsQueries(days);
  const [funnel, screens] = await Promise.all([
    queryAmplitude("/funnels", queries.funnel),
    queryAmplitude("/events/segmentation", queries.screens),
  ]);

  try {
    return { days, funnel: readFunnel(funnel), screens: readScreens(screens), computedAt: new Date().toISOString() };
  } catch (err) {
    logger.error({ err }, "Unexpected Amplitude answer");
    throw new HttpError(502, "Réponse inattendue d'Amplitude.");
  }
}

/** The page's figures for the period, computed at most every few minutes. */
export async function readOnboardingStats(days: OnboardingStatsPeriod): Promise<AdminOnboardingStats> {
  const cached = cache.get(days);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.stats;

  const stats = await computeStats(days);
  cache.set(days, { at: Date.now(), stats });
  return stats;
}
