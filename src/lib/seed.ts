import { DEFAULT_OWNERSHIP } from "./sync-model";
import type { AppcodeManifest, SnapshotEvent, StoreShape } from "./types";

export const SEED_APPCODE = "appcode-demo-0";

const manifest: AppcodeManifest = {
  appcode: SEED_APPCODE,
  name: "Demo: claims intake portal",
  description:
    "A sample appcode that shows how requirements, code and test evidence line up on one timeline.",
  owner: "demo-team",
  createdAt: "2026-01-05T09:00:00.000Z",
  bindings: [
    { source: "confluence", target: "confluence://DEMO/claims-discovery", mode: "stub", enabled: true },
    { source: "sharepoint", target: "sharepoint://sites/demo/Requirements", mode: "stub", enabled: true },
    { source: "git", target: "git://example.invalid/demo/claims-portal.git", mode: "stub", enabled: true },
    { source: "testing", target: "testing://demo/regression", mode: "stub", enabled: true },
  ],
  ownership: DEFAULT_OWNERSHIP.map((o) => ({ ...o })),
};

type Row = Pick<SnapshotEvent, "source" | "stage" | "occurredAt" | "title" | "detail" | "ref" | "provenance">;

const rows: Row[] = [
  {
    source: "confluence",
    stage: "pre-requirements",
    occurredAt: "2026-01-06T10:15:00.000Z",
    title: "Problem statement drafted",
    detail: "Claims handlers re-key the same data in three tools. The discovery page lists the pain points.",
    ref: "confluence:DEMO-101",
    provenance: "manual",
  },
  {
    source: "sharepoint",
    stage: "requirements",
    occurredAt: "2026-01-14T14:00:00.000Z",
    title: "Requirements v1.0 approved",
    detail: "Business owner signed off 24 functional requirements and 9 non-functional requirements.",
    ref: "sharepoint:Requirements-v1.0",
    provenance: "manual",
  },
  {
    source: "git",
    stage: "build",
    occurredAt: "2026-01-28T16:42:00.000Z",
    title: "Intake form merged to main",
    detail: "The first end-to-end intake flow landed behind a feature flag.",
    ref: "git:a1b2c3d",
    provenance: "manual",
  },
  {
    source: "testing",
    stage: "test",
    occurredAt: "2026-02-03T08:30:00.000Z",
    title: "Regression run 41 passed",
    detail: "212 of 212 checks passed on the release candidate build.",
    ref: "testing:run-41",
    provenance: "manual",
  },
  {
    source: "stage-gate",
    stage: "release",
    occurredAt: "2026-02-05T12:00:00.000Z",
    title: "Release gate cleared",
    detail: "Approvers confirmed requirements trace, passing tests and a rollback plan.",
    ref: "gate:release-1",
    provenance: "stage-gate",
  },
];

export function seedSnapshots(): SnapshotEvent[] {
  return rows.map((r, i) => ({
    ...r,
    id: `${SEED_APPCODE}:seed:${i + 1}`,
    appcode: SEED_APPCODE,
    recordedAt: r.occurredAt,
    sequenceNumber: i + 1,
    upstreamWritten: false,
    network: false,
  }));
}

export function buildSeedStore(): StoreShape {
  return {
    version: 1,
    projects: { [SEED_APPCODE]: { manifest: { ...manifest }, snapshots: seedSnapshots() } },
  };
}
