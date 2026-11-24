import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateAppcode } from "./appcode";
import { validateSnapshotContent, validateSnapshotMetadata } from "./content";
import { buildSeedStore } from "./seed";
import { DEFAULT_OWNERSHIP, stageOwnershipComplete } from "./sync-model";
import { sortTimeline } from "./timeline";
import type {
  AppcodeManifest,
  ConnectorBinding,
  NewSnapshot,
  ProjectRecord,
  SnapshotEvent,
  SourceKind,
  StoreShape,
} from "./types";
import { SOURCE_KINDS } from "./types";

const DEFAULT_BINDING_SOURCES: readonly SourceKind[] = ["confluence", "sharepoint", "git", "testing"];

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
  const target = storePath();
  const tmp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  try {
    renameSync(tmp, target);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore cleanup failure */
    }
    throw error;
  }
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
    return DEFAULT_BINDING_SOURCES.map((source) => ({
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
    if (b.mode === "live") {
      throw new StoreError('v1 rejects mode:"live"; use stub connectors only', "invalid");
    }
    return {
      source: b.source!,
      target: str(b.target, `${b.source}://unconfigured`),
      mode: b.mode === "local" ? ("local" as const) : ("stub" as const),
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

export interface UpdateProjectInput {
  name?: unknown;
  description?: unknown;
  owner?: unknown;
  bindings?: unknown;
}

/** Mutates manifest fields only — never clears or rewrites the snapshot ledger. */
export function updateProject(appcode: string, input: UpdateProjectInput): ProjectRecord {
  const state = load();
  const record = state.projects[appcode];
  if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
  if (input.name !== undefined) record.manifest.name = str(input.name, record.manifest.name);
  if (input.description !== undefined) {
    record.manifest.description = str(input.description, record.manifest.description);
  }
  if (input.owner !== undefined) record.manifest.owner = str(input.owner, record.manifest.owner);
  if (input.bindings !== undefined) record.manifest.bindings = parseBindings(input.bindings);
  save(state);
  return withSortedTimeline(record);
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
  const normalized = incoming.map((n, index) => {
    const contentCheck = validateSnapshotContent(n.content);
    if (!contentCheck.ok) throw new StoreError(contentCheck.error, "invalid");
    const metadataCheck = validateSnapshotMetadata(n.metadata);
    if (!metadataCheck.ok) throw new StoreError(metadataCheck.error, "invalid");
    return {
      raw: n,
      index,
      content: contentCheck.value,
      metadata: metadataCheck.value,
    };
  });

  const state = load();
  const record = state.projects[appcode];
  if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
  const known = new Set(record.snapshots.map((s) => s.id));
  const added: SnapshotEvent[] = [];
  let nextSeq =
    record.snapshots.reduce((max, s) => Math.max(max, s.sequenceNumber ?? 0), 0) + 1;

  for (const { raw, index, content, metadata } of normalized) {
    const id = raw.id ?? `${appcode}:${now.getTime()}:${record.snapshots.length + index}`;
    if (known.has(id)) continue;
    known.add(id);
    const event: SnapshotEvent = {
      ...raw,
      id,
      appcode,
      recordedAt: raw.recordedAt ?? now.toISOString(),
      // Treat 0/negative as unset — stubs historically passed sequenceNumber: 0.
      sequenceNumber:
        typeof raw.sequenceNumber === "number" && raw.sequenceNumber > 0
          ? raw.sequenceNumber
          : nextSeq++,
      upstreamWritten: false,
      network: raw.network ?? false,
    };
    if (content !== undefined) event.content = content;
    else delete event.content;
    if (metadata !== undefined) event.metadata = metadata;
    else delete event.metadata;
    record.snapshots.push(event);
    added.push(event);
  }
  if (added.length) save(state);
  return sortTimeline(added);
}

export function getTimeline(appcode: string): SnapshotEvent[] | undefined {
  return getProject(appcode)?.snapshots;
}
