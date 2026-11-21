---
cursor:
  subagentId: "bc-a5a4aa26-2f03-5474-a2ef-fb988adaa594"
  role: fr-nfr-author
---

# Mirevox `shadow-versioning` — Locked v1 Requirements (FR / NFR)

> **Docs honesty (2026-11-20 validation wave):** This FR/NFR matrix is the **target contract**. The runnable overnight slice is smaller — see `docs/v1-scope.md` and `docs/known-gaps.md`. Do not treat every FR-01…27 / NFR-01…10 row as implemented in the current GitHub tree. Acceptance against the full matrix remains partial/fail until a later milestone.

- **Product**: Mirevox `shadow-versioning` (`https://github.com/Mirevox/shadow-versioning`)
- **Status**: Locked aspirational contract; sign-off bar is `docs/v1-scope.md`
- **Date**: 2026-11-20
- **License**: Apache-2.0 (`LICENSE` + README)

- **Source Inputs**:
  - `/cursor/stores/self/docs/product-synthesis.md`
  - `/cursor/stores/self/docs/mirevox-build-plan.md`
  - `/cursor/stores/self/internal/council-playbook.md`
  - `/cursor/stores/self/internal/shadow-versioning/problem-opportunity.md`
  - `/cursor/stores/self/internal/shadow-versioning/requirements-draft.md`
  - `/cursor/stores/self/internal/shadow-versioning/market-gap.md`
  - `/cursor/stores/self/internal/shadow-versioning/devils-advocate.md`
  - `/cursor/stores/self/internal/shadow-versioning/architecture.md`

---

## 1. Purpose, v1 Boundary & Council Guardrails

`shadow-versioning` is an open-source, read-only **shadow projection** over project artifacts whose sources of truth stay in external tools (Confluence, SharePoint, Git hosts, and testing platforms). Rather than forcing non-technical contributors to learn Git commands or migrate documents into a heavy ALM suite, it binds external sources under one stable project identifier (`appCode`, e.g. `appcode-xyz-0`), captures **stage-owned snapshots** attributed to workflow stages (`stageId`), presents a **human-readable chronological timeline** via HTTP API and Web UI, and exposes decoupled **stage-gate hooks** for event and record linking with Mirevox `stage-gate`.

### 1.1 Locked Council Guardrails (Non-Negotiable for v1)

To reconcile the draft requirements, architecture, market gap, and devil's advocate reviews into an honest, shippable v1:

1. **Read-Only Projection, Single Writer (`writeOwner: "source"`):** External systems remain the sole authoritative writers for their documents/code/tests. `shadow-versioning` never writes back to Confluence, SharePoint, Git, or testing platforms and never performs bidirectional merges.
2. **Honest Stub Provenance (No Fake "Live" UI):** Every v1 connector stub performs **zero network I/O**, imports **zero vendor SaaS SDKs**, requires **zero external credentials/tokens**, and stamps every emitted snapshot with `isStub: true` and `verified: false`. Neither the UI nor the README lead may claim `"Live"`, `"Connected"`, or `"Up to date"` for stubbed sources.
3. **Server Clock Ordering & Append-Only Log:** Timeline ordering is governed strictly by the server-assigned `observedAt` timestamp (with monotonic `sequenceNumber` tie-breaker). Client- or source-supplied `sourceTimestamp` is stored for provenance and never used to reorder or backdate history. Persisted snapshots cannot be patched or individually deleted.
4. **No Raw Binary/Body Mirroring:** Snapshots store normalized metadata, plain-English summaries, external locators/deep-links, and deterministic hashes—never raw binary files or full mirrored SaaS document archives that would create an undeclared data-residency copy.
5. **Zero Hard Runtime Dependency on `stage-gate`:** Integration with `stage-gate` is strictly contract-based (HTTP JSON hooks, record links, and checked-in JSON fixture). `shadow-versioning` boots, syncs, renders timelines, and passes all tests standalone without `stage-gate` running.

### 1.2 Locked v1 Scope (In Scope)

1. **Project Manifest Management**: Create, validate, persist, list, load (API + JSON/YAML manifest file), and update `appCode` project manifests binding heterogeneous sources and stage ownership rules.
2. **Human-Readable Snapshot Timeline (API + UI)**: Reverse-chronological project timeline with plain-English labels/summaries, multi-facet filtering, artifact detail inspection, human-readable change delta vs. prior snapshot, and full Empty / Loading / Error UI state handling.
3. **Connector Stubs (Confluence, SharePoint, Git, Testing)**: Unified `ConnectorAdapter` contract with four deterministic, seedable connector stubs emitting realistic mock snapshots clearly marked as simulated (`isStub: true`), plus configurable simulated error modes.
4. **Stage-Owned Sync Model (`stageId` Ownership)**: Sync triggers, source ownership boundaries, sync runs, and persisted snapshots are explicitly owned by a `stageId`; model is both enforced in code/data and documented in repo `docs/`.
5. **Stage-Gate Conceptual Hooks**: Decoupled inbound event hook API, explicit snapshot-to-gate record linking API, queryable link history surfaced inline on the timeline, and an internal/outbound hook emitter with zero hard runtime dependency on `stage-gate`.
6. **Automated Test Suite**: Offline, deterministic unit, API integration, and UI state tests covering the core domain, all four stubs, error paths, and Empty/Loading/Error states.

### 1.3 Explicitly Out of Scope for v1 (Non-Goals)

- Live third-party OAuth / API ingestion from Confluence, SharePoint, GitHub/Bitbucket, or commercial test suites (v1 proves the adapter seam with deterministic stubs; live adapters are v2+).
- Bidirectional write-back to external tools or acting as a system of record / document editor / Git client (no commit, branch, merge, rebase, or document restore actions).
- Regulated ALM / compliance-ledger claims (no electronic signatures, legal hold, ReqIF, or claims of tamper-proof/universal cross-provider transactional clocks).
- LLM-generated diff summaries, background polling daemons/webhooks against external SaaS, or embedding the `stage-gate` stepper UI inside `shadow-versioning`.
- Automatic discovery/crawling of unconfigured repositories or sites; all bindings are explicit in the manifest.
- Multi-tenant enterprise RBAC/SSO, binary Office document diffing, or running the full Sherali homelab stack.

---

## 2. Domain Glossary & Normative Data Contracts

Implementations may choose any stack (e.g., TypeScript/Node or Python/FastAPI) provided the persisted data model and JSON API payloads preserve the following normative fields and invariants.

### 2.1 Canonical Identifiers

| Concept | Format / Rule | Example |
|---|---|---|
| `appCode` | Lowercase alphanumeric segments separated by single hyphens: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 3–64, unique per store. | `appcode-xyz-0` |
| `stageId` | Non-empty lowercase slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 2–64. Must match a stage declared in the project manifest. | `requirements`, `build`, `verification` |
| `sourceId` | Non-empty lowercase slug unique within a project manifest: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 2–64. | `confluence-prd`, `git-core-api` |
| `snapshotId` | Globally unique, immutable identifier (UUIDv4/ULID or prefixed deterministic ID in seeded mode). | `snap_01jcx...` |
| `gateId` | Non-empty identifier referencing a stage gate (e.g. `gate-req-signoff`). | `gate-req-signoff` |

### 2.2 Core Entities

1. **`ProjectManifest`**
   - `schemaVersion`: string (v1 literal `"1.0"`).
   - `appCode`: string (canonical project identifier, immutable after creation).
   - `name`: string (human-readable project name, 1–120 chars).
   - `description`: string (optional, <= 1,000 chars).
   - `stages`: non-empty array of `StageDefinition`:
     - `stageId`: string (unique within manifest).
     - `displayName`: string (human-readable stage label, e.g., `"Requirements"`).
     - `order`: integer >= 0 (logical workflow order).
   - `sources`: array of `SourceBinding`:
     - `sourceId`: string (unique within manifest).
     - `type`: enum `"confluence" | "sharepoint" | "git" | "testing"`.
     - `displayName`: string (human-readable label, e.g., `"Product Spec (Confluence)"`).
     - `locator`: string (canonical external reference such as space/page key, site/library/path, repo/branch, or test suite ID).
     - `ownerStageId`: string (required; must reference a declared `stageId` in `stages`).
     - `allowedStageIds`: optional array of additional `stageId`s permitted to trigger read-only syncs for this source (each must exist in `stages`; defaults to `[ownerStageId]`).
     - `writeOwner`: enum `"source"` (v1 enforces `"source"` only — shadow never writes back to external tools).
     - `mode`: enum `"stub"` (v1 connector stubs; future `"live"` adapters sit behind the same contract).
     - `enabled`: boolean (default `true`).
     - `config`: object (connector-specific non-secret configuration, including optional stub behavior settings such as `seed` or `simulateFailure`; inline raw tokens/passwords are rejected).
   - `createdAt`, `updatedAt`: ISO-8601 UTC timestamps.

2. **`Snapshot`** (append-only, immutable once persisted)
   - `snapshotId`: string.
   - `appCode`: string.
   - `sequenceNumber`: monotonically increasing positive integer per `appCode` (1, 2, 3...) for plain-English reference (e.g. `"Snapshot #4"`).
   - `stageId`: string (required; owning stage under which this snapshot was captured).
   - `substageId`: string | null (optional).
   - `sourceId`: string.
   - `sourceType`: enum `"confluence" | "sharepoint" | "git" | "testing"`.
   - `sourceDisplayName`: string.
   - `eventClass`: enum `"document_revision" | "file_version" | "code_change" | "test_execution"` (preserves distinct source semantics rather than flattening all changes into "version").
   - `title`: string (plain-English headline, e.g., `"Requirements page updated to v4"`).
   - `summary`: string (plain-English 1–3 sentence summary of what changed).
   - `author`: string | null (human display name or system actor if provided by source).
   - `sourceTimestamp`: ISO-8601 UTC timestamp reported by the source system (provenance only — never controls timeline sort order).
   - `observedAt`: ISO-8601 UTC server timestamp recorded when `shadow-versioning` captured the snapshot (authoritative sort key).
   - `capturedBy`: enum `"stage_sync" | "gate_hook" | "manual_stage_sync"`.
   - `externalRef`: string (provider revision/version/commit/run identifier, surfaced on expansion).
   - `deepLink`: string (URL or canonical external URI back to the authoritative source record).
   - `contentHash`: string (SHA-256 hex digest over normalized snapshot artifact payload).
   - `isStub`: boolean (`true` for all v1 connector stubs; never omitted).
   - `verified`: boolean (`false` for all v1 connector stubs; signals the record was not live-verified against a remote SaaS API).
   - `parentSnapshotId`: string | null (immediately preceding snapshot ID for the same `(appCode, sourceId)`, if any).
   - `artifacts`: non-empty array of `SnapshotArtifact`:
     - `artifactId`: string.
     - `title`: string.
     - `kind`: string (e.g., `"page"`, `"document"`, `"release_summary"`, `"test_suite_run"`).
     - `externalVersion`: string.
     - `changeSummary`: string (plain-English delta description).
     - `deepLink`: string.
     - `metadata`: object (technical details hidden by default in UI, visible on expansion).
   - `stageGateLinks`: array of `StageGateLinkSummary` (populated on read from linked gate records).

3. **`SyncRun`** (record of a stage-owned sync invocation)
   - `syncRunId`: string.
   - `appCode`: string.
   - `stageId`: string (required; the stage executing the sync).
   - `trigger`: enum `"manual" | "gate_hook" | "api"`.
   - `status`: enum `"succeeded" | "partial" | "failed"`.
   - `startedAt`, `completedAt`: ISO-8601 UTC timestamps.
   - `results`: array of per-source outcomes (`sourceId`, `sourceType`, `outcome`: `"created" | "unchanged" | "skipped_disabled" | "failed"`, `snapshotId`: string | null, `error`: `{ code, message }` | null).

4. **`StageGateHookEvent`** & **`StageGateLink`**
   - `StageGateHookEvent`:
     - `eventId`: string (unique per project; serves as idempotency key alongside optional `idempotencyKey`).
     - `eventType`: enum `"stage.entered" | "stage.completed" | "gate.requested" | "gate.approved" | "gate.rejected"`.
     - `appCode`: string.
     - `stageId`: string.
     - `gateId`: string | null (required when `eventType` starts with `gate.`).
     - `snapshotIds`: array of strings (optional; snapshots associated with the event).
     - `actor`: string (human or service identifier).
     - `note`: string | null (plain-English context/reason).
     - `occurredAt`: ISO-8601 UTC timestamp.
     - `receivedAt`: ISO-8601 UTC timestamp.
   - `StageGateLink` (append-only link record):
     - `linkId`: string.
     - `appCode`: string.
     - `stageId`: string.
     - `gateId`: string.
     - `snapshotId`: string.
     - `decision`: enum `"pending" | "approved" | "rejected" | "waived"`.
     - `eventId`: string | null (reference to triggering hook event, if created via hook).
     - `actor`: string.
     - `note`: string | null.
     - `createdAt`: ISO-8601 UTC timestamp.

---

## 3. Functional Requirements (FR)

### A. Project Manifest Creation, Loading & Validation

#### `FR-01` — Create Project Manifest (`appCode` + Source Bindings)
The system MUST allow creating a new project manifest bound to a unique `appCode`, declared workflow `stages`, and zero or more `sources` via HTTP API (`POST /api/projects`) and programmatic domain API.
- **Acceptance Criteria**:
  1. `POST /api/projects` with a valid manifest (e.g., `appCode: "appcode-xyz-0"`, stages `["pre-requirements", "requirements", "build", "verification"]`, and 4 sources) returns `201 Created` with the persisted `ProjectManifest` including `createdAt` and `updatedAt`.
  2. Creating a manifest with an existing `appCode` returns `409 Conflict` with error code `PROJECT_ALREADY_EXISTS` and does not overwrite the existing manifest.
  3. Persisted manifest remains retrievable after a service restart (`NFR-02`).

#### `FR-02` — Load Project Manifests from File/Fixture & Query via API
The system MUST support loading project manifests from a JSON (or YAML) manifest file/payload—both on startup via a configurable fixture/seed path and via an import/load API or CLI command—and listing/retrieving loaded manifests via API (`GET /api/projects`, `GET /api/projects/:appCode`).
- **Acceptance Criteria**:
  1. The repository ships at least one valid sample manifest fixture (e.g., `appcode-xyz-0` binding Confluence, SharePoint, Git, and Testing sources across stages) that loads cleanly with zero manual editing.
  2. `GET /api/projects` returns all registered manifests sorted deterministically by `appCode` (or `updatedAt` desc, documented and consistent).
  3. `GET /api/projects/:appCode` returns `200 OK` with full manifest metadata and bound sources, or `404 Not Found` (`PROJECT_NOT_FOUND`) for an unknown `appCode`.
  4. Loading an invalid manifest file fails fast with a structured validation error naming the file path and offending field(s), without corrupting already-loaded projects.

#### `FR-03` — Update Source Bindings & Stage Ownership Without Losing History
The system MUST allow adding, updating, or disabling source bindings and stage definitions on an existing project manifest (`PUT /api/projects/:appCode` or `PATCH /api/projects/:appCode/sources/:sourceId`) while preserving all previously captured snapshots.
- **Acceptance Criteria**:
  1. Adding a new valid source binding updates `updatedAt` and makes the source eligible for subsequent syncs under its `ownerStageId`.
  2. Disabling a source (`enabled: false`) causes future sync runs to mark it `skipped_disabled` while keeping all prior snapshots from that source visible in the timeline.
  3. Attempting to mutate `appCode` or remove a `stageId` still referenced as `ownerStageId` by an active source returns `400 Bad Request` / `409 Conflict` with a clear validation error.

#### `FR-04` — Strict Manifest Schema Validation
The system MUST validate all manifest inputs before persistence: `schemaVersion === "1.0"`, `appCode` regex compliance, non-empty `stages` with unique `stageId`s, unique `sourceId`s within the project, `source.type` in `{confluence, sharepoint, git, testing}`, `writeOwner === "source"`, every `ownerStageId` and `allowedStageIds[]` entry present in `stages`, and rejection of inline secret/token literals in `config`.
- **Acceptance Criteria**:
  1. Invalid `appCode` (e.g., `"My Project!"`, `"UPPER"`, `"a"`) returns `400 Bad Request` with `code: "VALIDATION_ERROR"` and field path `appCode`.
  2. Duplicate `sourceId`, unknown `source.type` (e.g., `"svn"`), or `writeOwner` set to anything other than `"source"` returns `400 Bad Request` identifying the exact index/field.
  3. A source binding referencing an undeclared `ownerStageId` returns `400 Bad Request` with `code: "UNKNOWN_STAGE_OWNER"`.
  4. Supplying inline credential fields (e.g., `config.apiToken`, `config.password`, `config.secret`) returns `400 Bad Request` with `code: "INLINE_SECRET_FORBIDDEN"`.

---

### B. Connector Stubs (Confluence, SharePoint, Git, Testing)

#### `FR-05` — Unified `ConnectorAdapter` Contract
All connectors MUST implement a common `ConnectorAdapter` interface defining at minimum: `type`, `validateConfig(config)`, and `captureSnapshot(context)` where `context` includes `appCode`, `stageId`, `sourceBinding`, `previousSnapshot` (optional), and `seed` / `iteration` state.
- **Acceptance Criteria**:
  1. Adding a new connector implementation requires implementing the single `ConnectorAdapter` interface and registering it in a connector registry—without modifying timeline query or stage-gate core logic.
  2. Calling `validateConfig` on invalid stub config returns structured validation failures prior to sync execution.

#### `FR-06` — Four Required v1 Connector Stubs Emitting Realistic Mock Snapshots
The system MUST ship four working connector stubs—`confluence`, `sharepoint`, `git`, and `testing`—each producing domain-authentic, human-readable mock snapshots with distinct `eventClass`, `externalRef`, `deepLink`, `sourceTimestamp`, `artifacts[]`, and `isStub: true`:
- **`confluence`** (`eventClass: "document_revision"`): emits mock wiki/PRD/ADR page revisions (e.g., `"Requirements Spec updated to revision 3"`, page ID + revision number, plain-English section change summary).
- **`sharepoint`** (`eventClass: "file_version"`): emits mock document library file versions (e.g., `"Architecture Sign-Off.docx updated to v2.1"`, site/library path + file version label, plain-English change note).
- **`git`** (`eventClass: "code_change"`): emits mock code/PR/release snapshots translated into non-technical language (e.g., `"Checkout validation changes merged (Release prep)"` as `title`, while retaining commit SHA / PR number / branch strictly inside `externalRef` and expandable `metadata`).
- **`testing`** (`eventClass: "test_execution"`): emits mock test run evidence (e.g., `"Integration Suite Run #14 passed (42/42 checks)"` or partial failure summary, run ID, pass/fail counts in `metadata`).
- **Acceptance Criteria**:
  1. Executing a sync for a manifest containing all four source types creates one valid `Snapshot` per enabled source, each passing schema validation with `isStub: true` and `verified: false`.
  2. Each stub produces its exact assigned `eventClass` and non-empty `title`, `summary`, `externalRef`, `deepLink`, `sourceTimestamp`, `observedAt`, and `artifacts` (length >= 1), while performing **zero outbound network I/O** and importing **zero live vendor SaaS SDKs**.
  3. Git stub `title` and `summary` MUST NOT use raw Git CLI verbs (`git push`, `rebase`, `cherry-pick`, `HEAD~`, `detached HEAD`, `fast-forward`) as user-facing descriptions.

#### `FR-07` — Deterministic Seedable Emission & Content-Hash Deduplication
Connector stubs MUST support deterministic, repeatable output (using a configurable seed or fixture sequence per source) and compute a deterministic SHA-256 `contentHash` over normalized artifact content so repeat syncs without source change do not spam duplicate snapshots.
- **Acceptance Criteria**:
  1. Given the same `(appCode, sourceId, seed, revisionCursor)`, a connector stub produces byte-identical normalized artifact payloads and identical `contentHash` across runs and restarts.
  2. When a stub is configured to advance revisions on successive syncs (default demo mode), Sync #1 creates revision N and Sync #2 creates revision N+1 with `parentSnapshotId` pointing to Sync #1's `snapshotId`.
  3. When a stub returns a payload whose `contentHash` matches the latest persisted snapshot for `(appCode, sourceId)` in the same `stageId`, the sync records outcome `"unchanged"` and does NOT create a duplicate snapshot.

#### `FR-08` — Simulated Connector Failure Modes
Each connector stub MUST support deterministic failure simulation via source `config.simulateFailure` (e.g., `"none" | "timeout" | "auth_error" | "unavailable" | "malformed_payload"`) and optional `config.delayMs` (bounded for testing) so error handling, loading states, and partial syncs can be verified reliably offline.
- **Acceptance Criteria**:
  1. Setting `config.simulateFailure: "auth_error"` on one source causes that source's sync outcome to be `"failed"` with a human-readable message and structured code (e.g., `CONNECTOR_AUTH_ERROR`).
  2. Setting `config.simulateFailure: "malformed_payload"` is caught by the sync runner's validation boundary and reported as `CONNECTOR_INVALID_PAYLOAD` without crashing the process or persisting a corrupt snapshot.

---

### C. Stage-Owned Sync Model (`stageId` Ownership)

#### `FR-09` — Mandatory `stageId` Ownership on Syncs, Sources & Snapshots
Every sync execution MUST declare an executing `stageId` (`POST /api/projects/:appCode/stages/:stageId/sync` or `POST /api/projects/:appCode/sync` with required body field `stageId`). Every created `Snapshot` and `SyncRun` MUST durably store `stageId`.
- **Acceptance Criteria**:
  1. Invoking sync without a `stageId` or with a `stageId` not declared in the project's `stages` returns `400 Bad Request` (`INVALID_STAGE_ID`).
  2. Every persisted `Snapshot` returned by timeline or detail APIs has a non-null `stageId` matching the sync's `stageId`.
  3. Every persisted `SyncRun` is queryable (`GET /api/projects/:appCode/sync-runs?stageId=...`) and records its owning `stageId`.

#### `FR-10` — Stage Ownership Enforcement & Isolation
A stage-owned sync for `stageId = S` MUST only sync enabled sources where `source.ownerStageId === S` or `S` is explicitly listed in `source.allowedStageIds`. Explicitly requesting a `sourceId` not owned by or allowed for `stageId = S` MUST be rejected.
- **Acceptance Criteria**:
  1. Given a manifest where `confluence-prd` has `ownerStageId: "requirements"` and `git-core-api` has `ownerStageId: "build"` (no cross-stage `allowedStageIds`), triggering a sync for `stageId: "requirements"` syncs ONLY `confluence-prd` and produces zero snapshots for `git-core-api`.
  2. Explicitly passing `sourceIds: ["git-core-api"]` to a sync for `stageId: "requirements"` returns `403 Forbidden` (or `409 Conflict` — pick one consistently and document it) with error code `STAGE_OWNERSHIP_VIOLATION` naming both the requested `stageId` and the source's `ownerStageId`.
  3. Triggering a sync in stage `"build"` NEVER mutates, deletes, or reassigns snapshots previously captured under `"requirements"`.

#### `FR-11` — Stage-Owned Sync Execution & Partial Failure Resilience
A stage sync across multiple bound sources MUST isolate connector failures per source: if 1 of 3 sources owned by `stageId` fails, the other 2 MUST still persist their snapshots and the `SyncRun` MUST complete with `status: "partial"` and HTTP `200 OK` (or `207 Multi-Status`, documented consistently). If all attempted sources fail, `SyncRun.status` MUST be `"failed"`.
- **Acceptance Criteria**:
  1. When 2 enabled sources succeed and 1 enabled source has `simulateFailure: "unavailable"`, the sync persists 2 snapshots, persists 1 `SyncRun` with `status: "partial"`, and returns per-source results listing both created `snapshotId`s and the 1 structured error.
  2. When all attempted sources for a stage fail, 0 snapshots are created, `SyncRun.status` is `"failed"`, and the response clearly reports every per-source failure.
  3. When a stage has 0 enabled sources bound to it, the sync returns a deterministic non-crashing response (`status: "succeeded"`, `results: []`, 0 snapshots created) rather than a 500 error.

#### `FR-12` — Stage-Owned Sync Model Documentation
The repository MUST include dedicated documentation (`docs/stage-owned-sync.md` or a clearly indexed section in `docs/architecture.md`) explaining:
1. Why stages—not global cron jobs or manual Git pushes—own sync boundaries.
2. Ownership rules (`ownerStageId`, `allowedStageIds`, immutability of captured `stageId`, partial failure handling).
3. Data flow diagram (ASCII/Mermaid) from `ProjectManifest` → Stage-Owned Sync → Connector Stubs → `Snapshot` Timeline → `StageGateLink`.
- **Acceptance Criteria**:
  1. Documentation exists in the repo `docs/` directory and matches the exact field names (`appCode`, `stageId`, `ownerStageId`, `allowedStageIds`, `SyncRun`) implemented in code and verified by tests.

---

### D. Human-Readable Snapshot Timeline API

#### `FR-13` — Chronological Project Snapshot Timeline API
The system MUST expose `GET /api/projects/:appCode/timeline` returning paginated timeline entries for the project, ordered reverse-chronologically by `observedAt` descending (with `sequenceNumber` descending as deterministic tie-breaker).
- **Acceptance Criteria**:
  1. Returns `200 OK` with `{ appCode, totalCount, items: Snapshot[], nextCursor: string | null }`.
  2. Supports `limit` (default 25, max 100; invalid values return `400 Bad Request`) and `cursor` pagination with zero duplicate or skipped items across pages.
  3. Returns `200 OK` with `items: [], totalCount: 0, nextCursor: null` for an existing project with no snapshots yet, and `404 Not Found` (`PROJECT_NOT_FOUND`) for an unknown `appCode`.

#### `FR-14` — Multi-Facet Timeline Filtering
`GET /api/projects/:appCode/timeline` MUST support composable query filters:
- `stageId` (exact match)
- `sourceType` (`confluence | sharepoint | git | testing`)
- `sourceId` (exact match)
- `gateId` (snapshots linked to a specific gate)
- `gateDecision` (`pending | approved | rejected | waived`)
- `from` / `to` (ISO-8601 UTC range over `observedAt`)
- `q` (case-insensitive substring search across `title`, `summary`, `sourceDisplayName`, and `artifacts[].title`)
- **Acceptance Criteria**:
  1. Combining filters (e.g., `?stageId=requirements&sourceType=confluence&q=spec`) applies logical AND and returns exact matching snapshots plus accurate `totalCount`.
  2. Invalid enum values (e.g., `sourceType=invalid`) or malformed timestamps (`from=not-a-date`) return `400 Bad Request` with `code: "VALIDATION_ERROR"`.

#### `FR-15` — Snapshot Detail & Human-Readable Comparison API
The system MUST expose `GET /api/projects/:appCode/snapshots/:snapshotId` returning full snapshot detail, expandable technical metadata (`externalRef`, `contentHash`, `artifacts[].metadata`), linked `stageGateLinks[]`, and a plain-English `delta` summary comparing the snapshot to its `parentSnapshotId` (e.g., `"Updated from revision 2 to revision 3"`, added/changed/removed artifact titles).
- **Acceptance Criteria**:
  1. Returns `200 OK` with full `Snapshot`, linked `stageGateLinks[]`, and `delta` object (`previousSnapshotId`, `hasChanges`, `summary`, `artifactChanges[]`).
  2. For a source's first snapshot (`parentSnapshotId: null`), `delta` reports `{ previousSnapshotId: null, hasChanges: true, summary: "Initial observed snapshot for this source", ... }`.
  3. Requesting a `snapshotId` that does not exist or belongs to a different `appCode` returns `404 Not Found` (`SNAPSHOT_NOT_FOUND`).

#### `FR-16` — Non-Technical Readability & Provenance Contract
Every timeline entry returned by the API MUST be immediately intelligible to a non-technical reviewer without requiring Git fluency, while preserving honest provenance.
- **Acceptance Criteria**:
  1. Every item includes `sequenceNumber`, `title`, `summary`, `sourceDisplayName`, `sourceType`, `eventClass`, `stageId`, `sourceTimestamp`, `observedAt`, `deepLink`, `isStub`, `verified`, and `stageGateLinks`.
  2. Automated contract tests verify that none of the default stub-generated `title` or `summary` fields contain raw Git CLI jargon (`git `, `HEAD~`, `rebase`, `cherry-pick`, `detached HEAD`, raw 40-char SHA as the sole title).
  3. `sourceTimestamp` and `observedAt` are always distinct fields; server-assigned `observedAt` (not client/source timestamps) strictly governs timeline ordering, and the system never implies cross-provider transactional atomicity.

---

### E. Human-Readable Snapshot Timeline UI (including Empty / Loading / Error States)

#### `FR-17` — Project Selector & Manifest Create/Load UI
The Web UI MUST let a user:
1. View and switch between loaded `appCode` projects, seeing each project's declared stages and bound sources (with source type, `ownerStageId`, enabled state, and simulated-stub indicator).
2. Create a new project manifest or load/import a manifest JSON payload (or one-click load the built-in sample manifest) directly from the UI.
- **Acceptance Criteria**:
  1. Submitting a valid new manifest in the UI creates the project via API, adds it to the selector, and switches the active view to that `appCode`.
  2. Submitting an invalid manifest displays clear field-level validation messages inline without losing the user's entered form values.

#### `FR-18` — Visual Snapshot Timeline & Expandable Detail View
The Web UI MUST render a human-readable vertical timeline for the selected `appCode` where each entry displays:
- Human-readable `title`, `sequenceNumber` (`#N`), and plain-English `summary`
- Distinct visual badge for `sourceType` (`Confluence`, `SharePoint`, `Git`, `Testing`) and `eventClass`
- Owning `stageId` badge (human `displayName` + `stageId`)
- Human-formatted timestamps (`observedAt` primary, `sourceTimestamp` visible on hover/detail)
- Explicit `Stub / Simulated` provenance pill whenever `isStub === true`
- Linked stage-gate pills (e.g., `Gate: gate-req-signoff · Approved`) when `stageGateLinks` is non-empty
- Clicking an entry opens a detail drawer/panel showing `artifacts[]`, human-readable `delta` vs. prior snapshot, clickable `deepLink`, gate link history, and an expandable `"Technical details"` disclosure containing `externalRef`, `contentHash`, and raw `metadata`.
- **Acceptance Criteria**:
  1. No raw Git CLI verbs or unlabelled 40-char hashes appear in collapsed timeline cards, and no stub-backed entry displays misleading labels such as `"Live"`, `"Connected"`, or `"Up to date"`.
  2. Expanding `"Technical details"` reveals `externalRef` and `contentHash`; collapsing hides them.
  3. Clicking a stage-gate pill or opening detail displays the linked `gateId`, `decision`, `actor`, `note`, and timestamp.

#### `FR-19` — Interactive Filtering & Stage-Owned Sync Trigger UI
The Web UI MUST provide controls to:
1. Filter the timeline by `stageId`, `sourceType`, `gateDecision`, and free-text search (`q`), updating results via the Timeline API.
2. Select a `stageId` and trigger a **Stage-Owned Sync** (`Run Sync for <Stage>`), displaying the resulting sync summary (created / unchanged / failed source counts) and refreshing the timeline in place.
3. Create a conceptual stage-gate record link (`Link to Gate`) from a snapshot detail panel (selecting `gateId`, `decision`, `actor`, `note`) so reviewers can exercise the stage-gate hook end-to-end in the UI.
- **Acceptance Criteria**:
  1. Selecting filter `stageId = requirements` updates the displayed entries to only `requirements`-owned snapshots and reflects active filter chips with a one-click reset.
  2. Clicking `Run Sync for <Stage>` triggers `POST /api/projects/:appCode/stages/:stageId/sync`, disables the button while in flight, updates the timeline with newly created snapshots, and displays a concise result banner.

#### `FR-20` — Mandatory Empty, Loading & Error UI States
The Web UI MUST explicitly implement and test all three state classes across every async surface (projects list, timeline feed, snapshot detail, sync execution, manifest creation):
1. **Empty States**:
   - *No projects exist*: Friendly empty state explaining what an `appCode` manifest does, with primary CTA `"Create Project Manifest"` and secondary CTA `"Load Sample Project (appcode-xyz-0)"`.
   - *Project exists, zero snapshots yet*: Friendly empty state naming the active `appCode` and its bound sources, with primary CTA `"Run Stage Sync"` to capture initial snapshots.
   - *Active filters match zero snapshots*: Distinct filter-empty state stating how many filters are active, with primary CTA `"Clear All Filters"`.
2. **Loading States**:
   - Visible skeleton loaders or progress indicators during initial project load, timeline fetch/filter refresh, and snapshot detail fetch.
   - In-flight stage sync shows a clear loading state (`"Syncing <Stage> sources..."`) and prevents duplicate concurrent submission for the same stage.
3. **Error States**:
   - *Network / API unreachable / 5xx*: Non-crashing error banner with `role="alert"`, human-readable message (no stack traces), and a working `"Retry"` button.
   - *404 Unknown `appCode`*: Clear `"Project not found"` state with link back to the project selector.
   - *400 Validation / 403/409 Stage Ownership Violation*: Inline actionable error explaining which field or stage ownership rule failed.
   - *Partial Sync Failure (`status: "partial"`)*: Warning callout listing succeeded sources alongside failed sources and their human-readable failure reason (e.g., `"SharePoint Docs failed: simulated auth error — other sources synced"`), while still rendering newly created snapshots.
- **Acceptance Criteria**:
  1. Every one of the three Empty states, two Loading states (fetch + sync), and four Error states (5xx/network, 404, 400/403, partial sync) is visually distinct, contains zero raw stack traces, and offers an actionable recovery path.
  2. Automated UI tests (`FR-27`) assert the presence and recovery behavior of Empty, Loading, and Error states.

---

### F. Stage-Gate Conceptual Hooks (Event & Record Linking)

#### `FR-21` — Inbound Stage-Gate Event Hook API
The system MUST expose `POST /api/projects/:appCode/hooks/stage-gate` to ingest stage-gate lifecycle events (`stage.entered`, `stage.completed`, `gate.requested`, `gate.approved`, `gate.rejected`).
- **Acceptance Criteria**:
  1. Valid event payload persists the `StageGateHookEvent`, creates `StageGateLink` record(s) for any referenced `snapshotIds` when `gateId` is present (mapping `gate.requested` → `pending`, `gate.approved` → `approved`, `gate.rejected` → `rejected`), and returns `201 Created` (or `200 OK` on idempotent replay).
  2. Re-submitting the same `eventId` (or `idempotencyKey`) for the same `appCode` is idempotent: returns `200 OK` with `{ deduplicated: true, event }` and creates zero duplicate events or links.
  3. Optional flag `captureSnapshot: true` on the hook payload triggers a stage-owned sync for the event's `stageId` (with `capturedBy: "gate_hook"`) and automatically links newly captured snapshots to the event/gate.
  4. Referencing an unknown `appCode` returns `404`; referencing an undeclared `stageId` or a `snapshotId` belonging to another project returns `400 Bad Request` / `404 Not Found` with a structured error.

#### `FR-22` — Explicit Snapshot-to-Gate Record Linking API
The system MUST expose:
- `POST /api/projects/:appCode/links/stage-gate` — explicitly links one or more `snapshotIds` to `(stageId, gateId, decision, actor, note)`.
- `GET /api/projects/:appCode/links/stage-gate` — queries gate links filterable by `stageId`, `gateId`, `snapshotId`, and `decision`.
- **Acceptance Criteria**:
  1. Linking a valid `snapshotId` creates an append-only `StageGateLink` record returned with `201 Created` and immediately surfaced in `Snapshot.stageGateLinks` on both `/timeline` and `/snapshots/:snapshotId`.
  2. Recording a subsequent decision for the same `(snapshotId, gateId)` (e.g., `pending` → `approved`) appends a new link record preserving chronological decision history rather than overwriting the earlier record.
  3. Attempting to link a `snapshotId` that does not belong to `:appCode` is rejected with `400 Bad Request` / `404 Not Found` (`SNAPSHOT_PROJECT_MISMATCH`).
  4. If the referenced snapshot's `stageId` differs from the link's `stageId`, the system either rejects it (`409 Conflict`, `STAGE_MISMATCH`) unless `allowCrossStageReference: true` is explicitly passed, and clearly records cross-stage status in the link metadata.

#### `FR-23` — Outbound Hook Dispatcher & Integration Contract Documentation
The system MUST provide a decoupled internal event bus / outbound hook interface (`StageGateHookEmitter`) that emits structured notifications when stage syncs complete (`sync.completed`) or gate links are recorded (`gate.linked`), with an in-memory/log subscriber in v1 and documented HTTP webhook payload schema for future `stage-gate` subscription.
- **Acceptance Criteria**:
  1. Subscribers registered on `StageGateHookEmitter` receive structured, schema-valid event objects on every completed stage sync and gate link creation.
  2. Outbound subscriber failure (e.g., throwing an error) MUST NOT roll back or fail the core snapshot/link persistence; errors are logged cleanly.
  3. Repo `docs/` documents the inbound and outbound JSON hook schemas with runnable `curl` examples, and `fixtures/` includes a valid sample stage-gate citation/link JSON payload (`fixtures/stage-gate-citation.json` or equivalent) referencing a demo snapshot shape.

#### `FR-24` — Standalone Resilience (Zero Hard Dependency on `stage-gate`)
`shadow-versioning` MUST boot, sync, render timelines, accept stage-gate hook calls, and record gate links with zero live connection to the `stage-gate` service.
- **Acceptance Criteria**:
  1. Starting `shadow-versioning` in an isolated environment with no other Mirevox services running succeeds with `GET /health` returning `200 OK` and all core + hook tests passing.

---

### G. Core Domain, Integration & UI Test Suite

#### `FR-25` — Core Domain Unit Tests
The repository MUST contain fast, offline unit tests verifying:
1. `ProjectManifest` schema validation, `appCode` regex enforcement, duplicate `appCode`/`sourceId` rejection, and undeclared `ownerStageId` rejection.
2. Stage-owned sync ownership rules (`ownerStageId`, `allowedStageIds`, rejection of cross-stage unauthorized sync, immutability of prior stage snapshots).
3. Snapshot immutability, `sequenceNumber` monotonicity, deterministic `contentHash` computation, deduplication on unchanged hash, and human-readable `delta` calculation.
4. Timeline ordering (`observedAt` desc, `sequenceNumber` desc tie-break), pagination cursor stability, and multi-facet filtering.
5. Stage-gate hook event validation, idempotency on duplicate `eventId`, append-only decision history, and cross-project snapshot link rejection.
- **Acceptance Criteria**:
  1. All core domain unit tests pass with 100% pass rate and >= 80% line coverage across the domain module.

#### `FR-26` — Connector Stub & HTTP API Integration Tests
The repository MUST contain integration tests verifying:
1. All four connector stubs (`confluence`, `sharepoint`, `git`, `testing`) emit schema-valid, deterministic, plain-English snapshots with `isStub: true` and `verified: false`, pass the no-Git-jargon readability assertion, and perform zero outbound network/socket calls.
2. Simulated failure modes (`auth_error`, `timeout`, `unavailable`, `malformed_payload`) produce isolated per-source failures and `SyncRun.status === "partial"` when paired with healthy sources.
3. Full end-to-end API flow: create/load manifest → run stage-owned sync → verify timeline & filters → inspect snapshot detail & delta → post stage-gate hook event (and idempotent replay) → query linked records → verify persistence across store reload/restart.
4. Negative API error envelope tests (`400`, `403`/`409`, `404`) asserting consistent JSON error schema and absence of stack traces.
- **Acceptance Criteria**:
  1. Full integration suite passes offline against an isolated temp data store with zero external network calls.

#### `FR-27` — UI Empty, Loading & Error State Tests
The repository MUST contain automated UI tests (component tests or headless browser tests) verifying:
1. Empty state when 0 projects exist, empty state when project has 0 snapshots, and empty state when filters match 0 items (including working `"Clear All Filters"` recovery).
2. Loading indicator visibility while timeline fetch or stage sync is pending, and disabled duplicate-submit protection during sync.
3. Error banner rendering (`role="alert"`) and retry action on simulated API 500/network failure, plus partial sync failure callout rendering.
4. Happy-path rendering of multi-source timeline cards (Confluence, SharePoint, Git, Testing badges, owning stage badge, `Stub` pill, gate status pill) and expanding `"Technical details"`.
- **Acceptance Criteria**:
  1. All UI state tests pass deterministically in CI/local test command without external network dependencies.

---

## 4. Non-Functional Requirements (NFR)

| ID | Category | Requirement | Measurable Acceptance Criterion |
|---|---|---|---|
| `NFR-01` | **Human-First Usability & Accessibility** | Primary UI copy and API timeline labels MUST be understandable by non-technical reviewers without Git fluency, and meet WCAG 2.1 AA baseline interaction accessibility. | 0 raw Git CLI verbs in default timeline card labels/summaries; all interactive filters, drawers, and sync triggers reachable via keyboard (`Tab`/`Enter`/`Esc`); loading and error regions expose ARIA `role="status"` / `role="alert"`; text contrast >= 4.5:1. |
| `NFR-02` | **Local-First Persistence & Durability** | All manifests, snapshots, sync runs, hook events, and gate links MUST persist locally across process restarts without requiring an external database server (e.g., embedded SQLite or atomic file-backed JSON/JSONL store). | Integration test creates a manifest, runs a sync, records a gate link, closes/re-instantiates the storage backend (or restarts the server), and verifies 100% of records are intact. |
| `NFR-03` | **Append-Only History & Provenance Integrity** | Persisted snapshots and stage-gate links MUST be append-only and carry explicit provenance (`isStub`, `stageId`, `sourceTimestamp`, `observedAt`, `contentHash`, `externalRef`). | No public API endpoint mutates or deletes an existing snapshot's `contentHash`, `stageId`, or `artifacts`; updating a manifest or adding a new gate decision appends history rather than overwriting prior records. |
| `NFR-04` | **Determinism & Offline Reproducibility** | Seeded fixtures, stub syncs, hashing, and the entire test suite MUST be deterministic and run 100% offline. | Running the full test suite twice consecutively with network disabled yields 100% pass rate and identical snapshot hashes for seeded fixtures. |
| `NFR-05` | **Local Performance** | API and UI MUST remain responsive on a single developer machine / home-lab container. | Measured locally on a 1,000-snapshot seeded dataset: manifest read/write p95 < 100 ms; timeline query (filtered or paginated) p95 < 150 ms; 4-stub stage sync (with `delayMs: 0`) completes in < 500 ms; initial UI render < 1.5 s. |
| `NFR-06` | **Consistent Error Contract & Observability** | Every non-2xx API response MUST return a uniform JSON envelope `{ "error": { "code": string, "message": string, "details"?: unknown, "requestId"?: string } }` without stack traces; server emits structured logs with correlation fields. | Negative API test suite confirms 100% of 4xx/5xx responses conform to the envelope and contain zero stack-trace strings (`at Object.`, `Traceback`, file paths); sync and hook handlers log `appCode`, `stageId`, and `syncRunId`/`eventId`. |
| `NFR-07` | **Modularity & Docker-Friendly Composability** | Codebase MUST cleanly separate `domain`, `connectors`, `storage`, `api`, `hooks`, and `ui` modules, expose `GET /health` (`200 OK`, `{ status: "ok", version }`), and include a working `Dockerfile` / `docker-compose.yml` (standalone, never launching the full Sherali homelab stack). | Static/directory inspection confirms decoupled module boundaries; `GET /health` responds `200 OK` within 50 ms; standalone app boots with a single documented command. |
| `NFR-08` | **Security Hygiene (v1 Baseline)** | All user- and stub-supplied text MUST be safely escaped in the UI (preventing XSS), request payloads MUST be strictly schema-validated with size bounds, and secret-like keys in connector configs MUST be redacted in API responses and logs. | Test injecting `<script>alert(1)</script>` in a manifest name or mock artifact title renders as escaped literal text; any config field matching `/token|secret|password|key/i` is redacted (`"[REDACTED]"`) in logs and `GET /api/projects` responses. |
| `NFR-09` | **Open-Source Onboarding & Portability** | Repository MUST include `README.md` (with quickstart, architecture overview, and composition with Mirevox `stage-gate`), `LICENSE` (Apache-2.0 or MIT), sample manifest fixture(s), and locked docs under `docs/`. | Fresh clone on Linux/macOS installs, boots with sample `appcode-xyz-0` manifest, and renders the timeline in <= 3 commands and < 3 minutes with zero external accounts or API keys. |
| `NFR-10` | **Automated Verification Speed & Coverage** | A single top-level test command MUST run unit, integration, and UI tests offline quickly enough for tight council iteration. | Single command completes in < 30 seconds locally with 0 failures and >= 80% line coverage on the core domain package. |

---

## 5. v1 Acceptance Verification Matrix

The Acceptance Council MUST verify every row below before signing off v1 for push to `https://github.com/Mirevox/shadow-versioning`.

| Capability Pillar | Locked Req IDs | Verification Method | Exit Gate (Pass Condition) |
|---|---|---|---|
| **Manifest Create / Load / Validate** | `FR-01`–`FR-04`, `NFR-02`, `NFR-08` | Unit + API integration tests + fixture load | Valid `appcode-xyz-0` fixture loads on startup; CRUD + restart durability pass; invalid `appCode`/stages/sources return `400`/`409`. |
| **4 Connector Stubs (Confluence, SharePoint, Git, Testing)** | `FR-05`–`FR-08`, `NFR-03`, `NFR-04` | Connector unit + integration tests | All 4 stubs emit deterministic, `isStub: true`, plain-English snapshots with distinct `eventClass`; unchanged hash deduplicates; simulated failures isolate cleanly. |
| **Stage-Owned Sync Model (`stageId` ownership)** | `FR-09`–`FR-12`, `NFR-03` | Unit + API integration tests + doc review | Sync requires valid `stageId`; unauthorized cross-stage source sync rejected (`403`/`409`); partial failures yield `status: "partial"`; `docs/` documents the model accurately. |
| **Human-Readable Timeline API** | `FR-13`–`FR-16`, `NFR-01`, `NFR-05`, `NFR-06` | API integration + perf benchmark | Reverse-chronological paginated timeline, multi-facet filters, detail + human `delta`, zero Git CLI jargon in primary labels, p95 < 150 ms at 1,000 snapshots. |
| **Human-Readable Timeline UI** | `FR-17`–`FR-19`, `NFR-01`, `NFR-08` | UI tests + manual/screenshot check | Project selector/create/load, readable multi-source cards with stage/stub/gate badges, expandable technical details, live filter & stage sync trigger, XSS-safe rendering. |
| **Empty / Loading / Error States** | `FR-20`, `NFR-01`, `NFR-06` | Automated UI state tests | All 3 empty states, fetch & sync loading states (with double-submit guard), and 4 error states (5xx/network, 404, 400/403, partial sync) verified with actionable recovery. |
| **Stage-Gate Conceptual Hooks** | `FR-21`–`FR-24`, `NFR-03`, `NFR-07` | Unit + API integration + doc review | Inbound events idempotent on `eventId`; explicit gate links append-only and rendered inline on timeline; outbound hook emitter tested; runs standalone without `stage-gate`. |
| **Core Domain, Integration & UI Tests** | `FR-25`–`FR-27`, `NFR-04`, `NFR-10` | Single-command test runner | 100% pass rate offline in < 30 s; >= 80% core domain line coverage; zero flaky wall-clock/network dependencies. |
