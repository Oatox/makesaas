import { z } from "zod";
import { ANALYTICS_EVENTS, LANDING_STEP, ONBOARDING_FUNNEL, PAGE_PATH_PROPERTY, PAGE_VIEWED_EVENT } from "@shared/analytics";
import type {
  AdminOnboardingStats,
  DeviceCounts,
  DeviceKind,
  OnboardingFunnelStep,
  OnboardingScreenStat,
  OnboardingStatsPeriod,
} from "@shared/admin";
import { AMPLITUDE_QUERY_URL } from "../lib/analytics";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";

/**
 * The admin's Onboarding page (/admin/onboarding): the funnel from the landing page's views (counted
 * apart) to the subscription, and the visitors who reach each screen, in all and per kind of device, read from Amplitude's Dashboard REST API
 * with the project's keys (VITE_AMPLITUDE_API_KEY and the server-only AMPLITUDE_SECRET_KEY).
 * Kept a few minutes per period: each query counts against Amplitude's rate limit.
 */

const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 20_000;
/** As in Amplitude's chart: a visitor has 30 days to go from the onboarding's first screen to the subscription. */
const CONVERSION_WINDOW_SECONDS = 30 * 24 * 60 * 60;

const NOT_CONFIGURED =
  "Amplitude n'est pas relié à l'admin : ajoute AMPLITUDE_SECRET_KEY (Amplitude → Settings → Projects → Secret Key) dans l'environnement du serveur.";

const cache = new Map<OnboardingStatsPeriod, { at: number; stats: AdminOnboardingStats }>();

type EventFilter = { subprop_type: "event"; subprop_key: string; subprop_op: string; subprop_value: string[] };
type QueryEvent = { event_type: string; filters?: EventFilter[]; group_by?: { type: "event" | "user"; value: string }[] };

const eventFilter = (key: string, op: string, value: string): EventFilter => ({
  subprop_type: "event",
  subprop_key: key,
  subprop_op: op,
  subprop_value: [value],
});

/**
 * Amplitude answers a query it has already computed from its own cache, for up to 2 hours, even as new
 * events arrive: the page stayed on the visitors of the morning. Each computation adds to the queried
 * events a filter that keeps all of them (no `step` label is that) but makes each query a new one, so
 * that Amplitude computes it again. The cache above (CACHE_MS) still spares its rate limit.
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

/** The funnel's steps queried in order: all but the landing page, counted apart (ONBOARDING_FUNNEL). */
const ORDERED_STEPS = ONBOARDING_FUNNEL.filter((step) => step !== LANDING_STEP);

/**
 * Each funnel step and its visitors: the landing page's from their own count, the others from
 * Amplitude's funnel answer (`cumulativeRaw`: users per step, from the onboarding's first screen).
 */
export function readFunnel(body: unknown, landingUsers: number): OnboardingFunnelStep[] {
  const counts = funnelResponseSchema.parse(body).data[0]?.cumulativeRaw ?? [];
  return ONBOARDING_FUNNEL.map((step) => ({
    label: step.label,
    users: step === LANDING_STEP ? landingUsers : (counts[ORDERED_STEPS.indexOf(step)] ?? 0),
  }));
}

const segmentationResponseSchema = z.object({
  data: z.object({
    // One label per group: the value itself, or [index, value]; two group-bys join their values with "; ".
    seriesLabels: z.array(z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])),
    seriesCollapsed: z.array(z.array(z.object({ value: z.number() }))),
  }),
});

/** Each group of a segmentation answer: its label ("04 social-proof", "Windows; Chrome 142") and its visitors. */
function segmentationGroups(body: unknown): { label: string; users: number }[] {
  const { seriesLabels, seriesCollapsed } = segmentationResponseSchema.parse(body).data;
  return seriesLabels.map((raw, index) => ({
    label: String(Array.isArray(raw) ? raw[raw.length - 1] : raw).trim(),
    users: seriesCollapsed[index]?.[0]?.value ?? 0,
  }));
}

/**
 * The browsers inside apps, as Amplitude names them in `os` ("Google 447": the Google app; TikTok's
 * browser shows as a WebView). Visitors coming from TikTok land there: they are counted apart from the
 * phone's own browser, whatever their device.
 */
export const IN_APP_BROWSERS = ["TikTok", "Instagram", "Facebook", "Messenger", "Snapchat", "Pinterest", "LinkedIn", "Twitter", "Google", "WebView"];

/** A device's kind, from Amplitude's `device_type` ("Apple iPhone", "Windows") and `os` (its browser). */
export function deviceKind(deviceType: string, os = ""): DeviceKind {
  const browser = os.toLowerCase();
  if (IN_APP_BROWSERS.some((name) => browser.includes(name.toLowerCase()))) return "in-app";
  if (/ipad|tablet|\btab\b|kindle/i.test(deviceType)) return "tablet";
  if (/^(windows|mac|linux|chrome ?os|ubuntu|fedora)/i.test(deviceType)) return "desktop";
  if (!deviceType || deviceType === "(none)") return /mobile|android|ios/i.test(browser) ? "mobile" : "desktop";
  return "mobile";
}

const noDevices = (): DeviceCounts => ({ desktop: 0, tablet: 0, "in-app": 0, mobile: 0 });

/** A screen's `step` label ("04 social-proof"): its position and its id; null for another shape ("(none)"). */
function screenLabel(label: string): { number: number; stepId: string } | null {
  const match = /^(\d+) (\S+)$/.exec(label);
  return match ? { number: Number(match[1]), stepId: match[2] } : null;
}

/**
 * Visitors per position in the onboarding, from the screens grouped by their `step` label ("04
 * social-proof"): screens at the same position (the branches after "experience") add up, as each
 * visitor sees one of them. Labels in another shape ("(none)": events sent before the label) are left out.
 * Per kind of device, from two more answers: the screens outside in-app browsers grouped by label and
 * device type ("04 social-proof; Apple iPhone"), and those in in-app browsers grouped by label.
 */
export function readScreens(totals: unknown, outsideApps: unknown, insideApps: unknown): OnboardingScreenStat[] {
  const byNumber = new Map<number, OnboardingScreenStat>();

  for (const { label, users } of segmentationGroups(totals)) {
    const screen = screenLabel(label);
    if (!screen) continue;
    const stat = byNumber.get(screen.number) ?? { number: screen.number, stepIds: [], users: 0, devices: noDevices() };
    stat.stepIds.push(screen.stepId);
    stat.users += users;
    byNumber.set(screen.number, stat);
  }

  const addDevice = (label: string, users: number, kind: DeviceKind) => {
    const screen = screenLabel(label);
    const stat = screen && byNumber.get(screen.number);
    if (stat) stat.devices[kind] += users;
  };
  for (const { label, users } of segmentationGroups(outsideApps)) {
    const [screen = "", deviceType = ""] = label.split("; ");
    addDevice(screen, users, deviceKind(deviceType));
  }
  for (const { label, users } of segmentationGroups(insideApps)) addDevice(label, users, "in-app");

  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

/** The visitors of a segmentation without group-by (its single series, over the whole period). */
export function readVisitors(body: unknown): number {
  return segmentationResponseSchema.parse(body).data.seriesCollapsed[0]?.[0]?.value ?? 0;
}

/** The landing page's visitors per kind of device, from its views grouped by device type and browser. */
export function readLandingDevices(body: unknown): DeviceCounts {
  const devices = noDevices();
  for (const { label, users } of segmentationGroups(body)) {
    const [deviceType = "", os = ""] = label.split("; ");
    devices[deviceKind(deviceType, os)] += users;
  }
  return devices;
}

/**
 * The queries of the page: the funnel from the onboarding's first screen, the visitors of each screen
 * (in all, then by kind of device: outside in-app browsers by device type, inside them), and those of
 * the landing page (in all, then by device).
 */
export function statsQueries(days: OnboardingStatsPeriod, now = new Date()) {
  const { start, end } = periodRange(days, now);
  const fresh = freshnessFilter(now.getTime());

  const funnelEvents: QueryEvent[] = ORDERED_STEPS.map((step) => ({
    event_type: step.event,
    filters: [
      ...(step.where ? [eventFilter(step.where.property, "is", step.where.value)] : []),
      ...(step.event === ANALYTICS_EVENTS.onboardingStepViewed ? [fresh] : []),
    ],
  }));
  const screensEvent = (byDevice = false): QueryEvent => ({
    event_type: ANALYTICS_EVENTS.onboardingStepViewed,
    filters: [eventFilter("step", "is not", "(none)"), fresh],
    group_by: [{ type: "event", value: "step" }, ...(byDevice ? [{ type: "user" as const, value: "device_type" }] : [])],
  });
  // Page views have no `step`: the freshness filter reads "(none)" there and keeps them all.
  const landingEvent = (byDevice = false): QueryEvent => ({
    event_type: PAGE_VIEWED_EVENT,
    filters: [eventFilter(PAGE_PATH_PROPERTY, "is", "/"), fresh],
    // Added up, the groups would count twice a visitor seen on two devices: the total is its own query.
    ...(byDevice && {
      group_by: [
        { type: "user" as const, value: "device_type" },
        { type: "user" as const, value: "os" },
      ],
    }),
  });
  const inApps = (op: "contains" | "does not contain"): [string, string] => [
    "s",
    JSON.stringify([{ prop: "os", op, values: IN_APP_BROWSERS }]),
  ];

  const funnel: [string, string][] = [
    ...funnelEvents.map((event): [string, string] => ["e", JSON.stringify(event)]),
    ["start", start],
    ["end", end],
    ["mode", "ordered"],
    ["n", "active"],
    ["cs", String(CONVERSION_WINDOW_SECONDS)],
  ];
  // Visitors over the whole period (by month, collapsed), up to 1000 groups (screens x device types).
  const segmentation = (event: QueryEvent, ...more: [string, string][]): [string, string][] => [
    ["e", JSON.stringify(event)],
    ["m", "uniques"],
    ["start", start],
    ["end", end],
    ["i", "30"],
    ["limit", "1000"],
    ...more,
  ];
  return {
    funnel,
    screens: segmentation(screensEvent()),
    screensOutsideApps: segmentation(screensEvent(true), inApps("does not contain")),
    screensInsideApps: segmentation(screensEvent(), inApps("contains")),
    landingTotal: segmentation(landingEvent()),
    landing: segmentation(landingEvent(true)),
  };
}

/** Amplitude refuses more than a few queries at once from a project (429 "Exceeded concurrent limit"). */
const CONCURRENT_QUERIES = 2;

/** The tasks' results in order, running at most CONCURRENT_QUERIES of them at a time. */
async function runFew<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENT_QUERIES, tasks.length) }, worker));
  return results;
}

async function computeStats(days: OnboardingStatsPeriod): Promise<AdminOnboardingStats> {
  const queries = statsQueries(days);
  const [funnel, screens, screensOutsideApps, screensInsideApps, landingTotal, landing] = await runFew([
    () => queryAmplitude("/funnels", queries.funnel),
    () => queryAmplitude("/events/segmentation", queries.screens),
    () => queryAmplitude("/events/segmentation", queries.screensOutsideApps),
    () => queryAmplitude("/events/segmentation", queries.screensInsideApps),
    () => queryAmplitude("/events/segmentation", queries.landingTotal),
    () => queryAmplitude("/events/segmentation", queries.landing),
  ]);

  try {
    const landingUsers = readVisitors(landingTotal);
    return {
      days,
      funnel: readFunnel(funnel, landingUsers),
      landing: { users: landingUsers, devices: readLandingDevices(landing) },
      screens: readScreens(screens, screensOutsideApps, screensInsideApps),
      computedAt: new Date().toISOString(),
    };
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
