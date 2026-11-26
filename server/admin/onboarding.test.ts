import { describe, expect, test } from "bun:test";
import { ANALYTICS_EVENTS, LANDING_STEP, ONBOARDING_FUNNEL, PAGE_PATH_PROPERTY, PAGE_VIEWED_EVENT } from "@shared/analytics";
import type { DeviceCounts } from "@shared/admin";
import {
  deviceKind,
  IN_APP_BROWSERS,
  periodRange,
  readFunnel,
  readLandingDevices,
  readScreens,
  readVisitors,
  statsQueries,
} from "./onboarding";

describe("readFunnel", () => {
  test("gives the landing page its own count, then each step its users from the onboarding, in order", () => {
    const counts = [120, 80, 60, 55, 40, 12, 5];
    const steps = readFunnel({ data: [{ cumulativeRaw: counts, cumulative: [], events: [] }] }, 300);
    expect(steps.map((s) => s.users)).toEqual([300, ...counts]);
    expect(steps.map((s) => s.label)).toEqual(ONBOARDING_FUNNEL.map((s) => s.label));
    expect(ONBOARDING_FUNNEL[0]).toBe(LANDING_STEP);
  });

  test("keeps every visitor who started the onboarding, even more than the landing page's", () => {
    const steps = readFunnel({ data: [{ cumulativeRaw: [11, 7, 6, 6, 6, 1, 0] }] }, 9);
    expect(steps.slice(0, 2).map((s) => s.users)).toEqual([9, 11]);
  });

  test("counts zero when Amplitude has no data", () => {
    expect(readFunnel({ data: [] }, 0).every((s) => s.users === 0)).toBe(true);
  });

  test("rejects an answer in another shape", () => {
    expect(() => readFunnel({ data: { cumulativeRaw: [] } }, 0)).toThrow();
  });
});

/** A segmentation answer with these groups and visitors. */
const answer = (groups: [string | number | (string | number)[], number][]) => ({
  data: { seriesLabels: groups.map(([label]) => label), seriesCollapsed: groups.map(([, value]) => [{ value }]) },
});
const none = answer([]);
const devices = (counts: Partial<DeviceCounts>): DeviceCounts => ({ desktop: 0, tablet: 0, "in-app": 0, mobile: 0, ...counts });

describe("deviceKind", () => {
  test("tells the browser inside an app first, whatever the device", () => {
    expect(deviceKind("Apple iPhone", "Google 447")).toBe("in-app");
    expect(deviceKind("Apple iPhone", "Mobile Safari UI/WKWebView 17")).toBe("in-app");
    expect(deviceKind("Android", "Chrome Mobile WebView 120")).toBe("in-app");
    expect(deviceKind("Apple iPhone", "TikTok 32")).toBe("in-app");
  });

  test("then tablets, computers and phones", () => {
    expect(deviceKind("Apple iPad", "Mobile Safari 17")).toBe("tablet");
    expect(deviceKind("Windows", "Chrome 156")).toBe("desktop");
    expect(deviceKind("Mac", "Safari 18")).toBe("desktop");
    expect(deviceKind("Apple iPhone", "Chrome Mobile iOS 158")).toBe("mobile");
    expect(deviceKind("Android", "Chrome Mobile 158")).toBe("mobile");
    expect(deviceKind("(none)", "Mobile Safari 26")).toBe("mobile");
    expect(deviceKind("(none)", "Firefox 161")).toBe("desktop");
  });
});

describe("readScreens", () => {
  test("orders the screens by position and adds up the branches of a position", () => {
    const screens = readScreens(
      answer([
        [[0, "10 analyse"], 40],
        [[0, "06 pq-jamais"], 30],
        [[0, "01 age"], 100],
        [[0, "06 pq-vendu"], 12],
      ]),
      none,
      none,
    );
    expect(screens).toEqual([
      { number: 1, stepIds: ["age"], users: 100, devices: devices({}) },
      { number: 6, stepIds: ["pq-jamais", "pq-vendu"], users: 42, devices: devices({}) },
      { number: 10, stepIds: ["analyse"], users: 40, devices: devices({}) },
    ]);
  });

  test("reads plain labels and leaves out events without the label", () => {
    const screens = readScreens(answer([["(none)", 9], ["02 profil", 7]]), none, none);
    expect(screens).toEqual([{ number: 2, stepIds: ["profil"], users: 7, devices: devices({}) }]);
  });

  test("counts each position's visitors per kind of device, the branches added up", () => {
    const screens = readScreens(
      answer([
        [[0, "01 age"], 10],
        [[0, "06 pq-jamais"], 5],
        [[0, "06 pq-vendu"], 3],
      ]),
      answer([
        [[0, "01 age; Windows"], 4],
        [[0, "01 age; Apple iPhone"], 3],
        [[0, "01 age; Apple iPad"], 1],
        [[0, "06 pq-jamais; Android"], 2],
        [[0, "06 pq-vendu; Apple iPhone"], 1],
        [[0, "(none); Windows"], 9],
      ]),
      answer([
        [[0, "01 age"], 2],
        [[0, "06 pq-vendu"], 2],
      ]),
    );
    expect(screens.map((s) => s.devices)).toEqual([
      devices({ desktop: 4, mobile: 3, tablet: 1, "in-app": 2 }),
      devices({ mobile: 3, "in-app": 2 }),
    ]);
  });
});

describe("readVisitors", () => {
  test("reads the single series of a query without group-by", () => {
    expect(readVisitors(answer([[0, 19]]))).toBe(19);
    expect(readVisitors(none)).toBe(0);
  });
});

describe("readLandingDevices", () => {
  test("sorts the landing page's visitors by device type and browser", () => {
    const counts = readLandingDevices(
      answer([
        [[0, "Windows; Chrome 117"], 3],
        [[0, "Apple iPhone; Chrome Mobile iOS 158"], 4],
        [[0, "Apple iPhone; Google 447"], 2],
        [[0, "Mac; Chrome 158"], 1],
      ]),
    );
    expect(counts).toEqual(devices({ desktop: 4, mobile: 4, "in-app": 2 }));
  });
});

describe("statsQueries", () => {
  // Amplitude serves the same query from its cache for up to 2 hours: each computation must be a new query.
  test("changes both queries from one computation to the next, within the same day", () => {
    const morning = statsQueries(30, new Date("2026-11-25T09:07:00Z"));
    const later = statsQueries(30, new Date("2026-11-25T10:37:00Z"));
    for (const key of ["funnel", "screens", "screensOutsideApps", "screensInsideApps", "landingTotal", "landing"] as const) {
      expect(later[key]).not.toEqual(morning[key]);
    }
  });

  test("splits the screens between in-app browsers and the others, by device type outside apps", () => {
    const queries = statsQueries(7, new Date("2026-11-25T09:07:00Z"));
    const param = (query: [string, string][], name: string) => JSON.parse(query.find(([key]) => key === name)![1]);

    expect(param(queries.screensOutsideApps, "s")).toEqual([{ prop: "os", op: "does not contain", values: IN_APP_BROWSERS }]);
    expect(param(queries.screensOutsideApps, "e").group_by).toEqual([
      { type: "event", value: "step" },
      { type: "user", value: "device_type" },
    ]);
    expect(param(queries.screensInsideApps, "s")).toEqual([{ prop: "os", op: "contains", values: IN_APP_BROWSERS }]);
    expect(param(queries.screensInsideApps, "e").group_by).toEqual([{ type: "event", value: "step" }]);
    expect(param(queries.landing, "e")).toMatchObject({
      event_type: PAGE_VIEWED_EVENT,
      group_by: [
        { type: "user", value: "device_type" },
        { type: "user", value: "os" },
      ],
    });
  });

  test("counts the landing page's visitors apart: the funnel does not require them", () => {
    const { funnel, landingTotal } = statsQueries(7, new Date("2026-11-25T09:07:00Z"));
    const events = funnel.filter(([key]) => key === "e").map(([, value]) => JSON.parse(value));
    expect(events.map((event) => event.event_type)).not.toContain(PAGE_VIEWED_EVENT);
    expect(events).toHaveLength(ONBOARDING_FUNNEL.length - 1);

    const landing = JSON.parse(landingTotal.find(([key]) => key === "e")![1]);
    expect(landing.event_type).toBe(PAGE_VIEWED_EVENT);
    expect(landing.filters[0]).toEqual({ subprop_type: "event", subprop_key: PAGE_PATH_PROPERTY, subprop_op: "is", subprop_value: ["/"] });
    expect(landing.group_by).toBeUndefined();
  });

  test("keeps every onboarding screen: the first one in the funnel, all of them by label", () => {
    const { funnel, screens } = statsQueries(7, new Date("2026-11-25T09:07:00Z"));
    const first = JSON.parse(funnel[0][1]);
    expect(first.event_type).toBe(ANALYTICS_EVENTS.onboardingStepViewed);
    expect(first.filters[0]).toMatchObject({ subprop_key: "step_number", subprop_op: "is", subprop_value: ["1"] });
    // The other filter excludes a label no screen has ("NN id").
    expect(first.filters[1]).toMatchObject({ subprop_key: "step", subprop_op: "is not" });
    expect(first.filters[1].subprop_value[0]).not.toMatch(/^\d+ \S+$/);
    expect(JSON.parse(screens[0][1]).filters.every((f: { subprop_op: string }) => f.subprop_op === "is not")).toBe(true);
  });
});

describe("periodRange", () => {
  test("covers the given number of days, today included", () => {
    expect(periodRange(7, new Date("2026-11-25T08:00:00Z"))).toEqual({ start: "20261119", end: "20261125" });
  });
});
