import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED_APPCODE, seedSnapshots } from "@/lib/seed";
import { appendSnapshots, createProject, getProject, getTimeline, StoreError } from "@/lib/store";
import { recordStageSnapshot, runStubSync } from "@/lib/sync-model";
import { sortTimeline } from "@/lib/timeline";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mirevox-"));
  process.env.MIREVOX_DATA_DIR = dir;
});
afterEach(() => {
  delete process.env.MIREVOX_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("timeline ordering", () => {
  it("sorts oldest first regardless of insertion order", () => {
    const shuffled = [...seedSnapshots()].reverse();
    const times = sortTimeline(shuffled).map((e) => Date.parse(e.occurredAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
  it("seeds appcode-demo-0 with all five stages", () => {
    const timeline = getTimeline(SEED_APPCODE)!;
    expect(timeline.map((e) => e.stage)).toEqual(["pre-requirements", "requirements", "build", "test", "release"]);
  });
  it("keeps appended out-of-order snapshots sorted", () => {
    const early = recordStageSnapshot({
      appcode: SEED_APPCODE, stage: "build", source: "git", title: "Backfilled commit", occurredAt: "2025-12-01T00:00:00.000Z",
    });
    appendSnapshots(SEED_APPCODE, [early]);
    expect(getTimeline(SEED_APPCODE)![0].title).toBe("Backfilled commit");
  });
  it("ignores duplicate snapshot ids so syncs are idempotent", async () => {
    const manifest = getProject(SEED_APPCODE)!.manifest;
    const first = appendSnapshots(SEED_APPCODE, await runStubSync(manifest));
    const second = appendSnapshots(SEED_APPCODE, await runStubSync(manifest));
    expect(first.length).toBe(4);
    expect(second.length).toBe(0);
  });
});

describe("project store", () => {
  it("creates projects with default ownership and rejects duplicates and bad appcodes", () => {
    const rec = createProject({ appcode: "appcode-new-1", name: "New app" });
    expect(rec.manifest.ownership).toHaveLength(5);
    expect(() => createProject({ appcode: "appcode-new-1" })).toThrow(StoreError);
    expect(() => createProject({ appcode: "Bad Code" })).toThrow(StoreError);
  });
});
