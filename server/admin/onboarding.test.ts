import { describe, expect, test } from "bun:test";
import { ONBOARDING_FUNNEL } from "@shared/analytics";
import { periodRange, readFunnel, readScreens } from "./onboarding";

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

describe("periodRange", () => {
  test("covers the given number of days, today included", () => {
    expect(periodRange(7, new Date("2026-11-25T08:00:00Z"))).toEqual({ start: "20261119", end: "20261125" });
  });
});
