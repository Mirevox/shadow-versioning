export const SOURCE_KINDS = ["confluence", "sharepoint", "git", "testing", "stage-gate"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const STAGES = ["pre-requirements", "requirements", "build", "test", "release"] as const;
export type Stage = (typeof STAGES)[number];

export type Provenance = "stub" | "manual" | "stage-gate";

export interface ConnectorBinding {
  source: SourceKind;
  /** Human-readable pointer to the upstream system, e.g. a Confluence space key or a repo URL. */
  target: string;
  /** Stub connectors never talk to the real system. */
  mode: "stub" | "live";
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
  /** When the change happened upstream (or was reported to have happened). */
  occurredAt: string;
  /** When Mirevox recorded the snapshot. */
  recordedAt: string;
  title: string;
  detail: string;
  /** Upstream reference such as a page id, commit sha, or run id. */
  ref: string | null;
  provenance: Provenance;
  /** Always false: shadow-versioning records observations and does not dual-write upstream. */
  upstreamWritten: false;
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

export type NewSnapshot = Omit<SnapshotEvent, "id" | "recordedAt" | "upstreamWritten"> &
  Partial<Pick<SnapshotEvent, "id" | "recordedAt">>;
