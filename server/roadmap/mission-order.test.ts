import { describe, expect, test } from "bun:test";
import { canUntickMission, missionBlocker, type MissionDone, type RoadmapStage } from "@shared/roadmap";

// Two small stages, built here so the order rule does not depend on the texts of the missions.
const mission = (key: string, kind: "manual" | "saas" | "logo") => ({ key, title: key, check: { kind } });
const STAGES = [
  { key: "a", title: "A", missions: [mission("a:auto", "saas"), mission("a:one", "manual"), mission("a:two", "manual")] },
  { key: "b", title: "B", missions: [mission("b:logo", "logo"), mission("b:one", "manual")] },
] as unknown as RoadmapStage[];

const ticked: MissionDone = { at: "2026-11-23T10:00:00Z", source: "declared" };
const seen: MissionDone = { at: "2026-11-23T10:00:00Z", source: "observed" };

describe("missions in order", () => {
  test("a mission waits for the first one before it still to do", () => {
    const done = { "a:auto": seen };
    expect(missionBlocker(STAGES, done, "a:one")).toBeNull();
    expect(missionBlocker(STAGES, done, "a:two")?.mission.key).toBe("a:one");
  });

  test("across stages, a mission waits for the stages before it, missions checked from the data included", () => {
    const done = { "a:auto": seen, "a:one": ticked, "a:two": ticked };
    const blocker = missionBlocker(STAGES, done, "b:one");
    expect(blocker?.mission.key).toBe("b:logo");
    expect(blocker?.stageIndex).toBe(1);
    expect(missionBlocker(STAGES, { ...done, "b:logo": seen }, "b:one")).toBeNull();
    expect(missionBlocker(STAGES, { "a:auto": seen }, "b:one")?.mission.key).toBe("a:one");
  });

  test("a ticked mission is unticked from the last one back", () => {
    const done = { "a:auto": seen, "a:one": ticked, "a:two": ticked };
    expect(canUntickMission(STAGES, done, "a:two")).toBe(true);
    expect(canUntickMission(STAGES, done, "a:one")).toBe(false);
    // Missions checked from the data after it do not hold it.
    expect(canUntickMission(STAGES, { "a:auto": seen, "a:one": ticked, "b:logo": seen }, "a:one")).toBe(true);
  });
});
