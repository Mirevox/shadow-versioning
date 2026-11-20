import { describe, expect, it } from "vitest";
import { buildSeedStore, SEED_APPCODE } from "../src/lib/seed";
import { sortTimeline } from "../src/lib/timeline";

describe("seed timeline", () => {
  it("sorts oldest-first deterministically", () => {
    const store = buildSeedStore();
    const timeline = store.projects[SEED_APPCODE].snapshots;
    const sorted = sortTimeline(timeline);
    expect(Date.parse(sorted[0].occurredAt)).toBeLessThanOrEqual(
      Date.parse(sorted[sorted.length - 1].occurredAt),
    );
    expect(sorted.some((e) => e.source === "stage-gate")).toBe(true);
    expect(sorted.every((e) => e.appcode === SEED_APPCODE)).toBe(true);
    expect(sorted.every((e) => e.upstreamWritten === false)).toBe(true);
  });
});
