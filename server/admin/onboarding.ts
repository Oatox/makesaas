import { z } from "zod";
import {
  ANALYTICS_EVENTS,
  LANDING_STEP,
  ONBOARDING_FUNNEL,
  ONBOARDING_PROPERTY_PREFIX,
  PAGE_PATH_PROPERTY,
  PAGE_VIEWED_EVENT,
} from "@shared/analytics";
import type {
  AdminOnboardingScreen,
  AdminOnboardingStats,
  DeviceCounts,
  DeviceKind,
  OnboardingAnswerStat,
  OnboardingFunnelStep,
  OnboardingScreenStat,
  OnboardingStatsPeriod,
} from "@shared/admin";
import { AMPLITUDE_QUERY_URL } from "../lib/analytics";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";

/**
 * The admin's Onboarding page (/admin/onboarding): the funnel from the landing page's views (counted
 * apart) to the subscription and the visitors who reach each screen, in all and per kind of device;
 * then, for a screen opened, the time visitors stay on it and the answers to its questions. Read from
 * Amplitude's Dashboard REST API with the project's keys (VITE_AMPLITUDE_API_KEY and the server-only
 * AMPLITUDE_SECRET_KEY). Kept a few minutes: each query counts against Amplitude's rate limit.
 */

const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 20_000;
/** As in Amplitude's chart: a visitor has 30 days to go from the onboarding's first screen to the subscription. */
const CONVERSION_WINDOW_SECONDS = 30 * 24 * 60 * 60;

const NOT_CONFIGURED =
  "Amplitude n'est pas relié à l'admin : ajoute AMPLITUDE_SECRET_KEY (Amplitude → Settings → Projects → Secret Key) dans l'environnement du serveur.";

const cache = new Map<OnboardingStatsPeriod, { at: number; stats: AdminOnboardingStats }>();
/** The time on a screen over a period, by `<days>:<number>:<last>`. */
const timesCache = new Map<string, { at: number; seconds: number | null }>();
/** The answers to one question over a period, by `<days>:<key>`. */
const answersCache = new Map<string, { at: number; answer: OnboardingAnswerStat }>();

type EventFilter = { subprop_type: "event" | "user"; subprop_key: string; subprop_op: string; subprop_value: string[] };
type QueryEvent = { event_type: string; filters?: EventFilter[]; group_by?: { type: "event" | "user"; value: string }[] };

const eventFilter = (key: string, op: string, value: string, type: EventFilter["subprop_type"] = "event"): EventFilter => ({
  subprop_type: type,
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

/** Amplitude refuses more than a few queries at once from a project (429 "Exceeded concurrent limit"). */
const CONCURRENT_QUERIES = 2;
let running = 0;
const waiting: (() => void)[] = [];

/**
 * Runs a query when its turn comes: at most CONCURRENT_QUERIES at once, whichever request asked (the
 * page's figures and the answers of a screen can be computed at the same time), the others in order.
 */
async function inTurn<T>(query: () => Promise<T>): Promise<T> {
  if (running < CONCURRENT_QUERIES) running++;
  // A query ending hands its place over: `running` stays the same.
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await query();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

/** A user property nobody has yet (a question nobody answered so far): Amplitude refuses a query on it. */
class UnknownPropertyError extends Error {}

async function queryAmplitude(path: string, params: [string, string][]): Promise<unknown> {
  const auth = authorization();
  if (!auth) throw new HttpError(503, NOT_CONFIGURED);

  const url = new URL(`${AMPLITUDE_QUERY_URL}${path}`);
  for (const [name, value] of params) url.searchParams.append(name, value);

  return inTurn(async () => {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      logger.warn({ err, path }, "Amplitude query failed");
      throw new HttpError(502, "Amplitude ne répond pas. Réessaie dans un instant.");
    }

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      if (res.status === 400 && body.includes("user_property_not_found")) throw new UnknownPropertyError();
      logger.warn({ status: res.status, path, body }, "Amplitude rejected a query");
      if (res.status === 401 || res.status === 403) {
        throw new HttpError(502, "Amplitude refuse l'accès : vérifie AMPLITUDE_SECRET_KEY, la Secret Key du même projet que VITE_AMPLITUDE_API_KEY.");
      }
      if (res.status === 429) throw new HttpError(503, "Trop de requêtes vers Amplitude. Réessaie dans une minute.");
      throw new HttpError(502, "Amplitude n'a pas pu calculer les chiffres.");
    }
    return res.json();
  });
}

/** Reads a query's answer: Amplitude's answer in another shape is its error, said as such. */
function read<T>(reader: () => T): T {
  try {
    return reader();
  } catch (err) {
    logger.error({ err }, "Unexpected Amplitude answer");
    throw new HttpError(502, "Réponse inattendue d'Amplitude.");
  }
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

const funnelTimesSchema = z.object({ data: z.array(z.object({ medianTransTimes: z.array(z.number()) })) });

/**
 * The median time from each step of a funnel answer to the next one, in seconds (null when nobody went
 * on): index 0 is the time from the first step to the second. Amplitude's `medianTransTimes` starts
 * with the whole funnel's time, then each step's from the one before, in milliseconds (-1: nobody).
 */
export function readStepTimes(body: unknown): (number | null)[] {
  const times = funnelTimesSchema.parse(body).data[0]?.medianTransTimes ?? [];
  return times.slice(1).map((ms) => (ms >= 0 ? ms / 1000 : null));
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
 * visitor sees one of them, and each keeps its own count (the most seen first). Labels in another
 * shape ("(none)": events sent before the label) are left out.
 * Per kind of device, from two more answers: the screens outside in-app browsers grouped by label and
 * device type ("04 social-proof; Apple iPhone"), and those in in-app browsers grouped by label.
 */
export function readScreens(totals: unknown, outsideApps: unknown, insideApps: unknown): OnboardingScreenStat[] {
  const byNumber = new Map<number, OnboardingScreenStat>();

  for (const { label, users } of segmentationGroups(totals)) {
    const screen = screenLabel(label);
    if (!screen) continue;
    const stat = byNumber.get(screen.number) ?? { number: screen.number, variants: [], users: 0, devices: noDevices() };
    stat.variants.push({ stepId: screen.stepId, users });
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

  const screens = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
  for (const screen of screens) screen.variants.sort((a, b) => b.users - a.users);
  return screens;
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

/** The views of the onboarding's screen at this position, whichever branch. */
const screenEvent = (number: number, fresh: EventFilter): QueryEvent => ({
  event_type: ANALYTICS_EVENTS.onboardingStepViewed,
  filters: [eventFilter("step_number", "is", String(number)), fresh],
});

/** A funnel over the period: its steps in this order, within the conversion window. */
const funnelParams = (events: QueryEvent[], start: string, end: string): [string, string][] => [
  ...events.map((event): [string, string] => ["e", JSON.stringify(event)]),
  ["start", start],
  ["end", end],
  ["mode", "ordered"],
  ["n", "active"],
  ["cs", String(CONVERSION_WINDOW_SECONDS)],
];

/** Visitors over the whole period (by month, collapsed), up to 1000 groups (screens x device types). */
const segmentationParams = (events: QueryEvent[], start: string, end: string, more: [string, string][] = []): [string, string][] => [
  ...events.map((event, index): [string, string] => [index === 0 ? "e" : `e${index + 1}`, JSON.stringify(event)]),
  ["m", "uniques"],
  ["start", start],
  ["end", end],
  ["i", "30"],
  ["limit", "1000"],
  ...more,
];

/** The landing page's views: autocapture's page views of "/". */
const landingViews = (fresh: EventFilter): QueryEvent => ({
  event_type: PAGE_VIEWED_EVENT,
  filters: [eventFilter(PAGE_PATH_PROPERTY, "is", "/"), fresh],
});

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
    ...landingViews(fresh),
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
  const segmentation = (event: QueryEvent, ...more: [string, string][]) => segmentationParams([event], start, end, more);

  return {
    funnel: funnelParams(funnelEvents, start, end),
    screens: segmentation(screensEvent()),
    screensOutsideApps: segmentation(screensEvent(true), inApps("does not contain")),
    screensInsideApps: segmentation(screensEvent(), inApps("contains")),
    landingTotal: segmentation(landingEvent()),
    landing: segmentation(landingEvent(true)),
  };
}

async function computeStats(days: OnboardingStatsPeriod): Promise<AdminOnboardingStats> {
  const queries = statsQueries(days);
  // Asked all at once, run in turn (inTurn).
  const [funnel, screens, screensOutsideApps, screensInsideApps, landingTotal, landing] = await Promise.all([
    queryAmplitude("/funnels", queries.funnel),
    queryAmplitude("/events/segmentation", queries.screens),
    queryAmplitude("/events/segmentation", queries.screensOutsideApps),
    queryAmplitude("/events/segmentation", queries.screensInsideApps),
    queryAmplitude("/events/segmentation", queries.landingTotal),
    queryAmplitude("/events/segmentation", queries.landing),
  ]);

  return read(() => {
    const landingUsers = readVisitors(landingTotal);
    return {
      days,
      funnel: readFunnel(funnel, landingUsers),
      landing: { users: landingUsers, devices: readLandingDevices(landing) },
      screens: readScreens(screens, screensOutsideApps, screensInsideApps),
      computedAt: new Date().toISOString(),
    };
  });
}

/** The page's figures for the period, computed at most every few minutes. */
export async function readOnboardingStats(days: OnboardingStatsPeriod): Promise<AdminOnboardingStats> {
  const cached = cache.get(days);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.stats;

  const stats = await computeStats(days);
  cache.set(days, { at: Date.now(), stats });
  return stats;
}

/** The user property holding the answer to a question of the onboarding (`gp:` for a property of the app's own). */
const answerProperty = (key: string) => `gp:${ONBOARDING_PROPERTY_PREFIX}${key}`;

/**
 * The answers to a question: the onboarding's events over the period (its screens and its end, the
 * events with a `step_count`), grouped by the question's user property, then the visitors who have one.
 * Every event of the onboarding, not only the screens after the question: an answer reaches Amplitude
 * after the next screen's view, and those of the last screens only with the onboarding's end.
 */
export function answersQuery(days: OnboardingStatsPeriod, key: string, now = new Date()): [string, string][] {
  const { start, end } = periodRange(days, now);
  const property = answerProperty(key);
  const onboarding = [eventFilter("step_count", "greater", "0"), freshnessFilter(now.getTime())];
  return segmentationParams(
    [
      { event_type: "_all", filters: onboarding, group_by: [{ type: "user", value: property }] },
      { event_type: "_all", filters: [...onboarding, eventFilter(property, "is not", "(none)", "user")] },
    ],
    start,
    end,
  );
}

/**
 * The answers to a question from answersQuery's answer: the first event's groups (each value and its
 * visitors, "(none)" left out), then the second event's single series, the visitors who answered.
 */
export function readAnswers(key: string, body: unknown): OnboardingAnswerStat {
  const groups = segmentationGroups(body);
  const answered = groups.pop()?.users ?? 0;
  const values = groups
    .filter((group) => group.label !== "(none)" && group.label !== "" && group.users > 0)
    .map((group) => ({ value: group.label, users: group.users }))
    .sort((a, b) => b.users - a.users);
  // A visitor counted in a value has answered, whatever the second series says.
  return { key, respondents: Math.max(answered, ...values.map((value) => value.users), 0), values };
}

async function computeAnswer(days: OnboardingStatsPeriod, key: string): Promise<OnboardingAnswerStat> {
  try {
    const body = await queryAmplitude("/events/segmentation", answersQuery(days, key));
    return read(() => readAnswers(key, body));
  } catch (err) {
    // Nobody has answered it yet: Amplitude does not know the property.
    if (err instanceof UnknownPropertyError) return { key, respondents: 0, values: [] };
    throw err;
  }
}

/**
 * The funnel from a screen to what comes after it (the next position's screen, or the onboarding's
 * end after the last one), for the time visitors stay on it; position 0 is the landing page, followed
 * by the onboarding's first screen. Two steps only: a funnel costs more with each step, and Amplitude
 * refuses a costly query run beside others.
 */
export function screenTimeQuery(days: OnboardingStatsPeriod, number: number, last: boolean, now = new Date()): [string, string][] {
  const { start, end } = periodRange(days, now);
  const fresh = freshnessFilter(now.getTime());
  const screen = number === 0 ? landingViews(fresh) : screenEvent(number, fresh);
  const after = last ? { event_type: ANALYTICS_EVENTS.onboardingCompleted } : screenEvent(number + 1, fresh);
  return funnelParams([screen, after], start, end);
}

/** The entry kept under `key` for a few minutes, or the one computed now. */
async function keptOrComputed<T extends object>(store: Map<string, { at: number } & T>, key: string, compute: () => Promise<T>) {
  const kept = store.get(key);
  if (kept && Date.now() - kept.at < CACHE_MS) return kept;
  const entry = { at: Date.now(), ...(await compute()) };
  store.set(key, entry);
  return entry;
}

/**
 * A screen of the onboarding over the period (position 0: the landing page; `last`: the onboarding's
 * last one): the median time visitors stay on it before what comes after, and the answers to its
 * questions (`keys`: the answers' ids). Each part is kept a few minutes.
 */
export async function readOnboardingScreen(
  days: OnboardingStatsPeriod,
  number: number,
  last: boolean,
  keys: string[],
): Promise<AdminOnboardingScreen> {
  const [time, ...answers] = await Promise.all([
    keptOrComputed(timesCache, `${days}:${number}:${last}`, async () => {
      const body = await queryAmplitude("/funnels", screenTimeQuery(days, number, last));
      return { seconds: read(() => readStepTimes(body)[0] ?? null) };
    }),
    ...keys.map((key) => keptOrComputed(answersCache, `${days}:${key}`, async () => ({ answer: await computeAnswer(days, key) }))),
  ]);
  return {
    medianSeconds: time.seconds,
    answers: answers.map((entry) => entry.answer),
    computedAt: new Date(Math.min(time.at, ...answers.map((entry) => entry.at))).toISOString(),
  };
}
