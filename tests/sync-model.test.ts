import { describe, expect, it } from "vitest";
import {
  DEFAULT_OWNERSHIP,
  OwnershipError,
  ownerOf,
  recordStageSnapshot,
  stageOwnershipComplete,
} from "@/lib/sync-model";
import { STAGES } from "@/lib/types";

const now = new Date("2026-03-01T00:00:00.000Z");

describe("stage ownership", () => {
  it("assigns exactly one owner to every stage", () => {
    expect(stageOwnershipComplete(DEFAULT_OWNERSHIP)).toBe(true);
    expect(DEFAULT_OWNERSHIP.map((o) => o.stage)).toEqual([...STAGES]);
  });
  it("maps stages to the documented owners", () => {
    expect(ownerOf("pre-requirements")).toBe("confluence");
    expect(ownerOf("requirements")).toBe("sharepoint");
    expect(ownerOf("build")).toBe("git");
    expect(ownerOf("test")).toBe("testing");
    expect(ownerOf("release")).toBe("stage-gate");
  });
  it("detects incomplete ownership", () => {
    expect(stageOwnershipComplete(DEFAULT_OWNERSHIP.slice(1))).toBe(false);
  });
});

describe("recordStageSnapshot", () => {
  it("records a stage-linked snapshot from the owning source", () => {
    const s = recordStageSnapshot({ appcode: "appcode-demo-1", stage: "build", source: "git", title: "Merge" }, undefined, now);
    expect(s.stage).toBe("build");
    expect(s.source).toBe("git");
    expect(s.recordedAt).toBe(now.toISOString());
    expect(s.id?.startsWith("appcode-demo-1:build:")).toBe(true);
  });
  it("rejects a source that does not own the stage", () => {
    expect(() =>
      recordStageSnapshot({ appcode: "appcode-demo-1", stage: "build", source: "confluence", title: "Edit" }, undefined, now),
    ).toThrow(OwnershipError);
  });
  it("produces stable ids for identical input", () => {
    const input = { appcode: "appcode-demo-1", stage: "test" as const, source: "testing" as const, title: "Run", occurredAt: now.toISOString() };
    expect(recordStageSnapshot(input, undefined, now).id).toBe(recordStageSnapshot(input, undefined, now).id);
  });
});
