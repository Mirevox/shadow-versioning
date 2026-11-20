import type { SnapshotEvent } from "./types";

/**
 * Newest first by server `recordedAt`, then `sequenceNumber`, then id.
 * `occurredAt` is display metadata only — it must not reorder the ledger.
 */
export function compareSnapshots(a: SnapshotEvent, b: SnapshotEvent): number {
  return (
    Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
    b.sequenceNumber - a.sequenceNumber ||
    b.id.localeCompare(a.id)
  );
}

export function sortTimeline(events: readonly SnapshotEvent[]): SnapshotEvent[] {
  return [...events].sort(compareSnapshots);
}

/** Oldest-first helper for tests that assert chronology of seed history. */
export function compareSnapshotsAscending(a: SnapshotEvent, b: SnapshotEvent): number {
  return -compareSnapshots(a, b);
}
