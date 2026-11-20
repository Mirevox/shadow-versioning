import { describe, expect, it } from "vitest";
import { buildSeedStore, SEED_APPCODE } from "../src/lib/seed";
import { sortTimeline } from "../src/lib/timeline";

describe("seed timeline", () => {
  it("orders newest-first by server recordedAt then sequenceNumber", () => {
    const store = buildSeedStore();
    const timeline = store.projects[SEED_APPCODE].snapshots;
    const sorted = sortTimeline(timeline);
    expect(Date.parse(sorted[0].recordedAt)).toBeGreaterThanOrEqual(
      Date.parse(sorted[sorted.length - 1].recordedAt),
    );
    expect(sorted[0].sequenceNumber).toBeGreaterThanOrEqual(
      sorted[sorted.length - 1].sequenceNumber,
    );
    expect(sorted.some((e) => e.source === "stage-gate")).toBe(true);
    expect(sorted.every((e) => e.appcode === SEED_APPCODE)).toBe(true);
    expect(sorted.every((e) => e.upstreamWritten === false)).toBe(true);
    expect(sorted.every((e) => typeof e.sequenceNumber === "number")).toBe(true);
  });
});
