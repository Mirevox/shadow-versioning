import { createHash } from "node:crypto";
import { compareSnapshotsAscending } from "./timeline";
import type {
  AppcodeVersionBundle,
  ProjectRecord,
  SnapshotEvent,
  SourceKind,
  SourceVersionPin,
} from "./types";
import { SOURCE_KINDS } from "./types";

function toSourcePin(snapshot: SnapshotEvent): SourceVersionPin {
  return {
    source: snapshot.source,
    snapshotId: snapshot.id,
    sequenceNumber: snapshot.sequenceNumber,
    recordedAt: snapshot.recordedAt,
    occurredAt: snapshot.occurredAt,
    stage: snapshot.stage,
    ref: snapshot.ref,
    title: snapshot.title,
    provenance: snapshot.provenance,
  };
}

function cloneCanonicalPins(
  pinned: Partial<Record<SourceKind, SourceVersionPin>>,
): Partial<Record<SourceKind, SourceVersionPin>> {
  const out: Partial<Record<SourceKind, SourceVersionPin>> = {};
  for (const source of SOURCE_KINDS) {
    const pin = pinned[source];
    if (pin) out[source] = { ...pin };
  }
  return out;
}

/**
 * Folds a project's snapshot ledger chronologically into monotonic composite
 * bundles (`appcode@v1`, `appcode@v2`, ...) where each bundle pins the latest
 * snapshot observed per source at that point in time.
 */
export function buildAppcodeVersionBundles(record: ProjectRecord): AppcodeVersionBundle[] {
  if (!record.snapshots.length) return [];

  const chronological = [...record.snapshots].sort(compareSnapshotsAscending);
  const pinned: Partial<Record<SourceKind, SourceVersionPin>> = {};
  const bundles: AppcodeVersionBundle[] = [];

  for (let i = 0; i < chronological.length; i += 1) {
    const snap = chronological[i];
    const versionNumber = i + 1;
    const version = `${record.manifest.appcode}@v${versionNumber}`;
    pinned[snap.source] = toSourcePin(snap);

    const sources = cloneCanonicalPins(pinned);
    const bundleHash = createHash("sha256")
      .update(
        JSON.stringify({
          appcode: record.manifest.appcode,
          versionNumber,
          triggerSnapshotId: snap.id,
          sources,
        }),
      )
      .digest("hex");

    bundles.push({
      version,
      versionNumber,
      appcode: record.manifest.appcode,
      bundleHash,
      createdAt: snap.recordedAt,
      triggerSnapshotId: snap.id,
      triggerSource: snap.source,
      triggerStage: snap.stage,
      triggerTitle: snap.title,
      snapshotCount: versionNumber,
      sources,
    });
  }

  return bundles;
}
