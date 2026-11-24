import { describe, expect, test } from "bun:test";
import { launchFinished, resumeLaunch } from "@shared/launch";

describe("resumeLaunch", () => {
  test("without a SaaS: the ideas, or the idea already chosen", () => {
    expect(resumeLaunch(null, false)).toBe("ideas");
    expect(resumeLaunch("project", false)).toBe("project");
    // Its SaaS deleted since: the ideas again, whatever the step saved.
    expect(resumeLaunch("plan", false)).toBe("ideas");
    expect(resumeLaunch("done", false)).toBe("ideas");
  });

  test("with a SaaS: the step saved, the plan when only the idea was saved", () => {
    expect(resumeLaunch("project", true)).toBe("plan");
    expect(resumeLaunch("plan", true)).toBe("plan");
    expect(resumeLaunch("tour", true)).toBe("tour");
    expect(resumeLaunch("mission", true)).toBe("mission");
    expect(resumeLaunch("done", true)).toBe("done");
  });

  test("a SaaS without any step saved is a launch finished before the steps were saved", () => {
    expect(resumeLaunch(null, true)).toBe("done");
    expect(launchFinished(null, true)).toBe(true);
  });

  test("the app opens only once the launch is over", () => {
    expect(launchFinished("mission", true)).toBe(false);
    expect(launchFinished("done", false)).toBe(false);
    expect(launchFinished("done", true)).toBe(true);
  });
});
