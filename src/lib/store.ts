import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { validateAppcode } from "./appcode";
import { DEFAULT_OWNERSHIP, stageOwnershipComplete } from "./sync-model";
import { sortTimeline } from "./timeline";
import type {
  AppcodeManifest,
  ConnectorBinding,
  NewSnapshot,
  ProjectRecord,
  SnapshotEvent,
  StoreShape,
} from "./types";
import { SOURCE_KINDS } from "./types";
import { buildSeedStore } from "./seed";

export class StoreError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid" | "conflict" | "not-found",
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export function dataDir(): string {
  return process.env.MIREVOX_DATA_DIR ?? path.join(process.cwd(), "data");
}

function storePath(): string {
  return path.join(dataDir(), "projects.json");
}

function load(): StoreShape {
  const file = storePath();
  if (!existsSync(file)) {
    const seeded = buildSeedStore();
    save(seeded);
    return seeded;
  }
  return JSON.parse(readFileSync(file, "utf8")) as StoreShape;
}

function save(state: StoreShape): void {
  mkdirSync(dataDir(), { recursive: true });
  const tmp = `${storePath()}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  renameSync(tmp, storePath());
}

function withSortedTimeline(record: ProjectRecord): ProjectRecord {
  return { manifest: record.manifest, snapshots: sortTimeline(record.snapshots) };
}

export function listProjects(): AppcodeManifest[] {
  return Object.values(load().projects)
    .map((p) => p.manifest)
    .sort((a, b) => a.appcode.localeCompare(b.appcode));
}

export function getProject(appcode: string): ProjectRecord | undefined {
  const record = load().projects[appcode];
  return record ? withSortedTimeline(record) : undefined;
}

export interface CreateProjectInput {
  appcode: unknown;
  name?: unknown;
  description?: unknown;
  owner?: unknown;
  bindings?: unknown;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseBindings(value: unknown): ConnectorBinding[] {
  if (value === undefined) {
    return SOURCE_KINDS.filter((s) => s !== "stage-gate").map((source) => ({
      source,
      target: `${source}://unconfigured`,
      mode: "stub" as const,
      enabled: true,
    }));
  }
  if (!Array.isArray(value)) throw new StoreError("bindings must be an array", "invalid");
  return value.map((raw) => {
    const b = raw as Partial<ConnectorBinding>;
    if (!b || !SOURCE_KINDS.includes(b.source as never)) {
      throw new StoreError(`binding source must be one of ${SOURCE_KINDS.join(", ")}`, "invalid");
    }
    return {
      source: b.source!,
      target: str(b.target, `${b.source}://unconfigured`),
      mode: b.mode === "live" ? "live" : "stub",
      enabled: b.enabled !== false,
    };
  });
}

export function createProject(input: CreateProjectInput, now: Date = new Date()): ProjectRecord {
  const check = validateAppcode(input.appcode);
  if (!check.ok) throw new StoreError(check.error, "invalid");
  const state = load();
  if (state.projects[check.appcode]) {
    throw new StoreError(`Project "${check.appcode}" already exists`, "conflict");
  }
  const manifest: AppcodeManifest = {
    appcode: check.appcode,
    name: str(input.name, check.appcode),
    description: str(input.description, "No description yet."),
    owner: str(input.owner, "unassigned"),
    createdAt: now.toISOString(),
    bindings: parseBindings(input.bindings),
    ownership: DEFAULT_OWNERSHIP.map((o) => ({ ...o })),
  };
  if (!stageOwnershipComplete(manifest.ownership)) throw new StoreError("ownership incomplete", "invalid");
  const record: ProjectRecord = { manifest, snapshots: [] };
  state.projects[check.appcode] = record;
  save(state);
  return record;
}

/**
 * Appends snapshots to a project's timeline. Snapshots whose id already exists
 * are skipped, which keeps repeated stub syncs idempotent. Returns only the
 * snapshots that were newly added.
 */
export function appendSnapshots(
  appcode: string,
  incoming: NewSnapshot[],
  now: Date = new Date(),
): SnapshotEvent[] {
  const state = load();
  const record = state.projects[appcode];
  if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
  const known = new Set(record.snapshots.map((s) => s.id));
  const added: SnapshotEvent[] = [];
  incoming.forEach((n, i) => {
    const id = n.id ?? `${appcode}:${now.getTime()}:${record.snapshots.length + i}`;
    if (known.has(id)) return;
    known.add(id);
    const event: SnapshotEvent = {
      ...n,
      id,
      appcode,
      recordedAt: n.recordedAt ?? now.toISOString(),
      upstreamWritten: false,
    };
    record.snapshots.push(event);
    added.push(event);
  });
  if (added.length) save(state);
  return sortTimeline(added);
}

export function getTimeline(appcode: string): SnapshotEvent[] | undefined {
  return getProject(appcode)?.snapshots;
}
