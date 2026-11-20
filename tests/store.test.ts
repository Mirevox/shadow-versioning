import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED_APPCODE } from "../src/lib/seed";
import {
  appendSnapshots,
  createProject,
  getProject,
  getTimeline,
  listProjects,
  StoreError,
} from "../src/lib/store";
import { runStubSync } from "../src/lib/sync-model";
import type { StoreShape } from "../src/lib/types";

const APP = "appcode-store-sync-1";

describe("store create and idempotent sync", () => {
  let dir = "";
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.MIREVOX_DATA_DIR;
    dir = mkdtempSync(path.join(tmpdir(), "mirevox-store-"));
    process.env.MIREVOX_DATA_DIR = dir;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.MIREVOX_DATA_DIR;
    else process.env.MIREVOX_DATA_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  });

  function storeFile(): string {
    return path.join(dir, "projects.json");
  }

  function readStore(): StoreShape {
    return JSON.parse(readFileSync(storeFile(), "utf8")) as StoreShape;
  }

  it("persists a new project in MIREVOX_DATA_DIR and reloads it", () => {
    const now = new Date("2026-11-20T06:00:00.000Z");
    const created = createProject(
      {
        appcode: `  ${APP}  `,
        name: "  Store sync fixture  ",
        description: "Created in a temp data dir.",
        owner: "qa",
        bindings: [
          { source: "git", target: "git://example.invalid/repo.git", mode: "stub", enabled: true },
        ],
      },
      now,
    );

    expect(created.manifest).toMatchObject({
      appcode: APP,
      name: "Store sync fixture",
      description: "Created in a temp data dir.",
      owner: "qa",
      createdAt: "2026-11-20T06:00:00.000Z",
    });
    expect(created.manifest.bindings).toEqual([
      { source: "git", target: "git://example.invalid/repo.git", mode: "stub", enabled: true },
    ]);
    expect(created.snapshots).toEqual([]);
    expect(created.manifest.ownership.map((row) => row.stage)).toEqual([
      "pre-requirements",
      "requirements",
      "build",
      "test",
      "release",
    ]);

    expect(getProject(APP)?.manifest).toEqual(created.manifest);
    expect(listProjects().map((project) => project.appcode)).toEqual([SEED_APPCODE, APP]);

    const onDisk = readStore();
    expect(onDisk.version).toBe(1);
    expect(onDisk.projects[APP].manifest.name).toBe("Store sync fixture");
    expect(onDisk.projects[APP].snapshots).toEqual([]);
    expect(onDisk.projects[SEED_APPCODE]).toBeDefined();
  });

  it("rejects a duplicate appcode and leaves the original manifest in place", () => {
    createProject({ appcode: APP, name: "original" }, new Date("2026-11-20T06:00:00.000Z"));

    let caught: unknown;
    try {
      createProject({ appcode: APP, name: "replacement" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(StoreError);
    expect((caught as StoreError).code).toBe("conflict");
    expect(getProject(APP)?.manifest.name).toBe("original");
    expect(readStore().projects[APP].manifest.name).toBe("original");
  });

  it("rejects an invalid appcode before writing the store", () => {
    let caught: unknown;
    try {
      createProject({ appcode: "APPCODE-demo-0" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(StoreError);
    expect((caught as StoreError).code).toBe("invalid");
    expect(existsSync(storeFile())).toBe(false);
  });

  it("does not persist a project when bindings are invalid", () => {
    let caught: unknown;
    try {
      createProject({ appcode: APP, bindings: [{ source: "svn" }] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(StoreError);
    expect((caught as StoreError).code).toBe("invalid");
    expect(readStore().projects[APP]).toBeUndefined();
    expect(readStore().projects[SEED_APPCODE]).toBeDefined();
  });

  it("appends stub sync snapshots once and skips the same ids on replay", async () => {
    const now = new Date("2026-11-20T06:30:00.000Z");
    const created = createProject({ appcode: APP, name: "sync target" }, now);
    const fetched = await runStubSync(created.manifest, now);

    expect(fetched).toHaveLength(4);
    expect(new Set(fetched.map((event) => event.id)).size).toBe(4);
    expect(
      fetched.every(
        (event) => event.provenance === "stub" && event.upstreamWritten === false && event.network === false,
      ),
    ).toBe(true);

    const added = appendSnapshots(APP, fetched, now);
    expect(added.map((event) => event.id).sort()).toEqual(fetched.map((event) => event.id).sort());
    expect(added.every((event) => event.upstreamWritten === false && event.network === false)).toBe(true);

    const replay = await runStubSync(created.manifest, now);
    expect(appendSnapshots(APP, replay, now)).toEqual([]);

    const beforeReplayWrite = readFileSync(storeFile(), "utf8");
    expect(appendSnapshots(APP, [fetched[0], fetched[0], fetched[1]], now)).toEqual([]);
    expect(readFileSync(storeFile(), "utf8")).toBe(beforeReplayWrite);
    expect(getTimeline(APP)).toHaveLength(4);
    expect(readStore().projects[APP].snapshots).toHaveLength(4);

    const novel = {
      id: `${APP}:manual:once`,
      appcode: APP,
      source: "git" as const,
      stage: "build" as const,
      occurredAt: "2026-11-20T07:00:00.000Z",
      title: "One new observation",
      detail: "Recorded once even if the batch repeats the id.",
      ref: "manual-1",
      provenance: "manual" as const,
      network: false,
    };
    const once = appendSnapshots(APP, [novel, novel], now);
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({
      id: novel.id,
      upstreamWritten: false,
      network: false,
      recordedAt: now.toISOString(),
    });
    expect(appendSnapshots(APP, [novel], now)).toEqual([]);
    expect(getTimeline(APP)).toHaveLength(5);
    expect(getProject(APP)?.manifest).toEqual(created.manifest);
  });

  it("does not create a project when appending to an unknown appcode", () => {
    let caught: unknown;
    try {
      appendSnapshots("appcode-missing-9", [
        {
          appcode: "appcode-missing-9",
          source: "git",
          stage: "build",
          occurredAt: "2026-11-20T06:00:00.000Z",
          title: "should not persist",
          detail: "",
          ref: null,
          provenance: "manual",
          network: false,
        },
      ]);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(StoreError);
    expect((caught as StoreError).code).toBe("not-found");
    expect(readStore().projects["appcode-missing-9"]).toBeUndefined();
    expect(readStore().projects[SEED_APPCODE]).toBeDefined();
  });
});
