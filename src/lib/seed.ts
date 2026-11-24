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
    { source: "jira", target: "jira://DEMO/claims-intake", mode: "stub", enabled: true },
    { source: "git", target: "git://example.invalid/demo/claims-portal.git", mode: "stub", enabled: true },
    { source: "testing", target: "testing://demo/regression", mode: "stub", enabled: true },
  ],
  ownership: DEFAULT_OWNERSHIP.map((o) => ({ ...o })),
};

type Row = Pick<
  SnapshotEvent,
  "source" | "stage" | "occurredAt" | "title" | "detail" | "content" | "metadata" | "ref" | "provenance"
>;

const rows: Row[] = [
  {
    source: "confluence",
    stage: "pre-requirements",
    occurredAt: "2026-01-06T10:15:00.000Z",
    title: "Problem statement drafted",
    detail: "Claims handlers re-key the same data in three tools. The discovery page lists the pain points.",
    content:
      "Discovery brief for claims intake portal: claims handlers currently re-key applicant policy numbers, incident dates, and supporting document references across three disconnected systems. Primary users are intake specialists and regional claims supervisors. Success means single-entry validation, full audit traceability, and under two minutes average intake handling time.",
    metadata: { stageId: "pre-requirements", space: "DEMO", pageId: "DEMO-101" },
    ref: "confluence:DEMO-101",
    provenance: "manual",
  },
  {
    source: "sharepoint",
    stage: "requirements",
    occurredAt: "2026-01-14T14:00:00.000Z",
    title: "Requirements v1.0 approved",
    detail: "Business owner signed off 24 functional requirements and 9 non-functional requirements.",
    content:
      "Signed functional and non-functional requirements specification v1.0 for claims intake portal. Covers 24 functional requirements including policy lookup, attachment checksum validation, duplicate claim detection, and role-based triage routing, plus 9 non-functional requirements covering 99.9% availability, audit logging, and PII encryption at rest.",
    metadata: { stageId: "requirements", version: "1.0", document: "Requirements-v1.0" },
    ref: "sharepoint:Requirements-v1.0",
    provenance: "manual",
  },
  {
    source: "git",
    stage: "build",
    occurredAt: "2026-01-28T16:42:00.000Z",
    title: "Intake form merged to main",
    detail: "The first end-to-end intake flow landed behind a feature flag.",
    content:
      "Merged intake workflow module behind feature flag claims_intake_v1. Implemented form validation schema, policy number normalization helper, submission ledger persistence, and integration error boundary without modifying upstream SharePoint or Confluence documents.",
    metadata: { stageId: "build", commitSha: "a1b2c3d", branch: "main" },
    ref: "git:a1b2c3d",
    provenance: "manual",
  },
  {
    source: "testing",
    stage: "test",
    occurredAt: "2026-02-03T08:30:00.000Z",
    title: "Regression run 41 passed",
    detail: "212 of 212 checks passed on the release candidate build.",
    content:
      "Regression suite run-41 completed cleanly on release candidate build a1b2c3d: 212 passed, 0 failed, 0 skipped across intake validation, policy lookup contract, duplicate suppression, and accessibility smoke assertions.",
    metadata: { stageId: "test", runId: "run-41", passed: "212", failed: "0", skipped: "0" },
    ref: "testing:run-41",
    provenance: "manual",
  },
  {
    source: "stage-gate",
    stage: "release",
    occurredAt: "2026-02-05T12:00:00.000Z",
    title: "Release gate cleared",
    detail: "Approvers confirmed requirements trace, passing tests and a rollback plan.",
    content:
      "Release gate decision cleared for appcode-demo-0 after verifying traceability from discovery and requirements v1.0 through build a1b2c3d and regression run 41, with documented feature-flag rollback plan.",
    metadata: { stageId: "release", gateDecision: "cleared", ref: "gate:release-1" },
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
