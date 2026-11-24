import { createHash } from "node:crypto";
import { getConnector } from "./connectors";
import { validateSnapshotContent, validateSnapshotMetadata } from "./content";
import type {
  AppcodeManifest,
  NewSnapshot,
  Provenance,
  SourceKind,
  Stage,
  StageOwnership,
} from "./types";
import { STAGES } from "./types";

/**
 * Stage-owned sync: each stage has exactly one owning source. Shadow-versioning
 * observes that source and records a snapshot. It never pushes the same change
 * to a second system, so there is no dual-write to reconcile.
 */
export const DEFAULT_OWNERSHIP: readonly StageOwnership[] = [
  { stage: "pre-requirements", owner: "confluence", rationale: "Discovery notes live in wiki pages." },
  { stage: "requirements", owner: "sharepoint", rationale: "Signed-off requirements are controlled documents." },
  { stage: "build", owner: "git", rationale: "Source history is the record of what was built." },
  { stage: "test", owner: "testing", rationale: "Test runs are the evidence for quality." },
  { stage: "release", owner: "stage-gate", rationale: "Release approval is decided at the gate." },
];

export function ownerOf(stage: Stage, ownership: readonly StageOwnership[] = DEFAULT_OWNERSHIP): SourceKind {
  const entry = ownership.find((o) => o.stage === stage);
  if (!entry) throw new Error(`No owner configured for stage "${stage}"`);
  return entry.owner;
}

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function stageOwnershipComplete(ownership: readonly StageOwnership[]): boolean {
  return STAGES.every((s) => ownership.filter((o) => o.stage === s).length === 1);
}

/** UI copy: who to trust for a stage. */
export function ownershipBlurb(row: StageOwnership): string {
  return `During ${row.stage}, trust ${row.owner}. Shadow versioning only records a snapshot — it does not overwrite that system.`;
}

export interface StageSnapshotInput {
  appcode: string;
  stage: Stage;
  /** The source that reported the change. Must be the stage owner. */
  source: SourceKind;
  title: string;
  detail?: string;
  content?: string;
  metadata?: Record<string, string>;
  /** Optional caller-supplied idempotency token so retries produce the exact same snapshot id. */
  eventId?: string;
  ref?: string | null;
  occurredAt?: string;
  provenance?: Provenance;
}

export class OwnershipError extends Error {
  constructor(
    public readonly stage: Stage,
    public readonly expected: SourceKind,
    public readonly actual: SourceKind,
  ) {
    super(`Stage "${stage}" is owned by "${expected}"; a snapshot from "${actual}" was rejected.`);
    this.name = "OwnershipError";
  }
}

/**
 * Builds a stage-linked snapshot. Rejects reports from a source that does not
 * own the stage. The result is a local record only: `upstreamWritten` is false.
 */
export function recordStageSnapshot(
  input: StageSnapshotInput,
  ownership: readonly StageOwnership[] = DEFAULT_OWNERSHIP,
  now: Date = new Date(),
): NewSnapshot {
  const expected = ownerOf(input.stage, ownership);
  if (input.source !== expected) throw new OwnershipError(input.stage, expected, input.source);
  const occurredAt = input.occurredAt ?? now.toISOString();
  const normalizedEventId = input.eventId?.trim();
  const idSeed = normalizedEventId
    ? [input.appcode, input.stage, input.source, "event", normalizedEventId].join("|")
    : [input.appcode, input.stage, input.source, input.title, input.ref ?? "", occurredAt].join("|");
  const digest = createHash("sha1").update(idSeed).digest("hex").slice(0, 12);

  const contentRes = validateSnapshotContent(input.content);
  const content = contentRes.ok ? contentRes.value : undefined;
  const metaRes = validateSnapshotMetadata(input.metadata);
  const baseMeta = metaRes.ok ? metaRes.value : undefined;
  const mergedMeta =
    normalizedEventId || baseMeta
      ? {
          ...(baseMeta ?? {}),
          ...(normalizedEventId ? { eventId: normalizedEventId } : {}),
        }
      : undefined;

  return {
    id: `${input.appcode}:${input.stage}:${digest}`,
    appcode: input.appcode,
    source: input.source,
    stage: input.stage,
    occurredAt,
    recordedAt: now.toISOString(),
    title: input.title,
    detail: input.detail ?? "",
    ...(content !== undefined ? { content } : {}),
    ...(mergedMeta ? { metadata: mergedMeta } : {}),
    ref: input.ref ?? null,
    provenance: input.provenance ?? "manual",
    network: false,
  };
}

/** Runs every enabled stub/local connector configured for this manifest. */
export async function runStubSync(manifest: AppcodeManifest, now: Date = new Date()): Promise<NewSnapshot[]> {
  const out: NewSnapshot[] = [];
  for (const binding of manifest.bindings) {
    if (!binding.enabled) continue;
    const connector = getConnector(binding.source);
    if (!connector) continue;
    const events = await connector.fetchSnapshots({ appcode: manifest.appcode, binding, now });
    for (const event of events) {
      if (event.stage && ownerOf(event.stage, manifest.ownership) !== event.source) continue;
      out.push(event);
    }
  }
  return out;
}
