import type { SnapshotEvent } from "./types";

/** Oldest first; ties break on recordedAt then id so ordering is stable and deterministic. */
export function compareSnapshots(a: SnapshotEvent, b: SnapshotEvent): number {
  return (
    Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
    Date.parse(a.recordedAt) - Date.parse(b.recordedAt) ||
    a.id.localeCompare(b.id)
  );
}

export function sortTimeline(events: readonly SnapshotEvent[]): SnapshotEvent[] {
  return [...events].sort(compareSnapshots);
}
