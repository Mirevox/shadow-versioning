import { describe, expect, it } from "vitest";
import { seedStore } from "../src/lib/seed";

describe("seed timeline", () => {
  it("orders newest-first when sorted", () => {
    const store = seedStore();
    const timeline = store.projects["appcode-demo-0"].timeline;
    const sorted = [...timeline].sort((a, b) => b.at.localeCompare(a.at));
    expect(sorted[0].at >= sorted[sorted.length - 1].at).toBe(true);
    expect(sorted.some((e) => e.source === "stage-gate")).toBe(true);
    expect(sorted.every((e) => e.appcode === "appcode-demo-0")).toBe(true);
  });
});
