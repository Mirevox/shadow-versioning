export const SOURCE_KINDS = [
  "confluence",
  "sharepoint",
  "git",
  "testing",
  "jira",
  "stage-gate",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const STAGES = ["pre-requirements", "requirements", "build", "test", "release"] as const;
export type Stage = (typeof STAGES)[number];

export type Provenance = "stub" | "local" | "manual" | "stage-gate";

export const MAX_CONTENT_CHARS = 32_768;

export interface ConnectorBinding {
  source: SourceKind;
  /** Human-readable pointer to the upstream system, e.g. a Confluence space key or a repo URL. */
  target: string;
  /** Stub connectors never talk to the real system. */
  mode: "stub" | "local" | "live";
  enabled: boolean;
}

export interface StageOwnership {
  stage: Stage;
  /** The one source that owns this stage's record of truth. Shadow-versioning reads it; it never writes back. */
  owner: SourceKind;
  rationale: string;
}

export interface SnapshotEvent {
  id: string;
  appcode: string;
  source: SourceKind;
  stage: Stage | null;
  /** When the change happened upstream (or was reported to have happened). Display only. */
  occurredAt: string;
  /** When Mirevox recorded the snapshot (server clock — governs timeline order). */
  recordedAt: string;
  /** Monotonic per-project append order assigned by the store. */
  sequenceNumber: number;
  title: string;
  detail: string;
  /** Substantive normalized text captured from the upstream artifact (capped at MAX_CONTENT_CHARS). */
  content?: string;
  /** Structured plain-string metadata attached to the snapshot (e.g. stageId, issueKey, loop-guard fields). */
  metadata?: Record<string, string>;
  /** Upstream reference such as a page id, commit sha, or run id. */
  ref: string | null;
  provenance: Provenance;
  /** Always false: shadow-versioning records observations and does not dual-write upstream. */
  upstreamWritten: false;
  /**
   * Stub connectors never leave the process. Live connectors may set true later.
   * Devil’s-advocate rule: stub responses must advertise network:false.
   */
  network: boolean;
}

export interface AppcodeManifest {
  appcode: string;
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  bindings: ConnectorBinding[];
  ownership: StageOwnership[];
}

export interface ProjectRecord {
  manifest: AppcodeManifest;
  snapshots: SnapshotEvent[];
}

export interface StoreShape {
  version: 1;
  projects: Record<string, ProjectRecord>;
}

export type NewSnapshot = Omit<
  SnapshotEvent,
  "id" | "recordedAt" | "upstreamWritten" | "sequenceNumber"
> &
  Partial<Pick<SnapshotEvent, "id" | "recordedAt" | "sequenceNumber">>;

export interface SourceVersionPin {
  source: SourceKind;
  snapshotId: string;
  sequenceNumber: number;
  recordedAt: string;
  occurredAt: string;
  stage: Stage | null;
  ref: string | null;
  title: string;
  provenance: Provenance;
}

export interface AppcodeVersionBundle {
  version: string;
  versionNumber: number;
  appcode: string;
  bundleHash: string;
  createdAt: string;
  triggerSnapshotId: string;
  triggerSource: SourceKind;
  triggerStage: Stage | null;
  triggerTitle: string;
  snapshotCount: number;
  sources: Partial<Record<SourceKind, SourceVersionPin>>;
}
