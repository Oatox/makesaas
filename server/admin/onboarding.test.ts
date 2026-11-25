import { describe, expect, test } from "bun:test";
import { ONBOARDING_FUNNEL } from "@shared/analytics";
import { periodRange, readFunnel, readScreens, statsQueries } from "./onboarding";

describe("readFunnel", () => {
  test("gives each funnel step its users, in order", () => {
    const counts = [120, 80, 60, 55, 40, 12, 5];
    const steps = readFunnel({ data: [{ cumulativeRaw: counts, cumulative: [], events: [] }] });
    expect(steps.map((s) => s.users)).toEqual(counts);
    expect(steps.map((s) => s.label)).toEqual(ONBOARDING_FUNNEL.map((s) => s.label));
  });

  test("counts zero when Amplitude has no data", () => {
    expect(readFunnel({ data: [] }).every((s) => s.users === 0)).toBe(true);
  });

  test("rejects an answer in another shape", () => {
    expect(() => readFunnel({ data: { cumulativeRaw: [] } })).toThrow();
  });
});

describe("readScreens", () => {
  test("orders the screens by position and adds up the branches of a position", () => {
    const screens = readScreens({
      data: {
        seriesLabels: [[0, "10 analyse"], [0, "06 pq-jamais"], [0, "01 age"], [0, "06 pq-vendu"]],
        seriesCollapsed: [[{ value: 40 }], [{ value: 30 }], [{ value: 100 }], [{ value: 12 }]],
      },
    });
    expect(screens).toEqual([
      { number: 1, stepIds: ["age"], users: 100 },
      { number: 6, stepIds: ["pq-jamais", "pq-vendu"], users: 42 },
      { number: 10, stepIds: ["analyse"], users: 40 },
    ]);
  });

  test("reads plain labels and leaves out events without the label", () => {
    const screens = readScreens({
      data: { seriesLabels: ["(none)", "02 profil"], seriesCollapsed: [[{ value: 9 }], [{ value: 7 }]] },
    });
    expect(screens).toEqual([{ number: 2, stepIds: ["profil"], users: 7 }]);
  });
});

describe("statsQueries", () => {
  // Amplitude serves the same query from its cache for up to 2 hours: each computation must be a new query.
  test("changes both queries from one computation to the next, within the same day", () => {
    const morning = statsQueries(30, new Date("2026-11-25T09:07:00Z"));
    const later = statsQueries(30, new Date("2026-11-25T10:37:00Z"));
    expect(later.funnel).not.toEqual(morning.funnel);
    expect(later.screens).not.toEqual(morning.screens);
  });

  test("keeps every onboarding screen: the first one in the funnel, all of them by label", () => {
    const { funnel, screens } = statsQueries(7, new Date("2026-11-25T09:07:00Z"));
    const first = JSON.parse(funnel[0][1]);
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
