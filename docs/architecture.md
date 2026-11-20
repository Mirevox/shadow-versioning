---
cursor:
  subagentId: "bc-a5a4aa26-2f03-5474-a2ef-fb988adaa594"
  role: architect
---

# Mirevox `shadow-versioning` — v1 Architecture

**Repository target:** `https://github.com/Mirevox/shadow-versioning`  
**Status:** Architecture specification for runnable v1 slice  
**Pairs with:** Mirevox `stage-gate` (workflow stepper + gatekeeper)

> **Docs honesty (2026-11-20):** Large sections below describe a **target** stack (Hono, Vite SPA, SQLite, `/api/v1/*`, DriftAlert). The **shipped overnight tree** is Next.js 16 App Router + file JSON store (`data/projects.json`) on port `3847` with routes under `/api/*`. Treat `docs/v1-scope.md`, `docs/sync-model.md`, and `src/` as ground truth for what runs today.

---

## 1. Architectural Thesis & Design Principles

`shadow-versioning` gives non-technical and cross-functional teams a single, human-readable version timeline across Confluence, SharePoint, Git (GitHub/Bitbucket), and testing platforms—bound together by a stable project identifier (`appcode-xyz-0`)—without forcing anyone to learn Git verbs or migrate their daily tools into Git.

Four architectural constraints govern v1:

1. **Observational ledger, never a competing primary editor.** Humans keep editing in the tool that fits their stage (Confluence, SharePoint, Git, or a test platform). `shadow-versioning` records immutable point-in-time snapshots, tracks cross-tool provenance, and surfaces plain-English comparisons.
2. **Single authoritative owner per `(artifactClass, stage)` to eliminate dual-write chaos.** Bi-directional auto-sync between Confluence, SharePoint, and Git fails in practice (formatting loss, ping-pong loops, silent overwrites). Instead, each workflow stage designates one authoritative system per artifact; edits elsewhere are surfaced as explicit drift alerts rather than silently reconciled.
3. **Zero Git jargon in human interfaces.** Terms like `commit`, `SHA`, `rebase`, `detached HEAD`, `cherry-pick`, `merge conflict`, and `force-push` never appear in UI copy or primary API concepts. Internal content hashes stay under the hood.
4. **Cloud-VM runnable now, homelab-Docker ready later.** v1 runs as a single TypeScript process backed by embedded SQLite + local content-addressed files—zero external databases, brokers, or SaaS credentials required to run, demo, or test.

---

## 2. Module Boundaries (Runnable v1)

The codebase is partitioned into eight cohesive modules with unidirectional dependencies so parallel builders and testers can work against stable TypeScript interfaces.

```text
+----------------------------------------------------------------------+
|  ui (React + Vite SPA, served statically by api in production)       |
+----------------------------------+-----------------------------------+
                                   | HTTP / JSON (/api/v1/*)
+----------------------------------v-----------------------------------+
|  api (Hono HTTP server + Zod validation + simulator dev endpoints)   |
+------+-------------+-----------------+------------------+------------+
       |             |                 |                  |
       v             v                 v                  v
+------------+ +------------+ +----------------+ +--------------------+
|  manifest  | | ownership  | |    timeline    | | integrations/      |
| (appcode   | | (stage-    | | (immutable     | | stage-gate         |
|  bindings) | |  owned     | |  snapshots,    | | (gate readiness,   |
|            | |  sync &    | |  plain diffs,  | |  stage seal,       |
|            | |  drift)    | |  safe restore) | |  outbound hooks)   |
+-----+------+ +-----+------+ +-------+--------+ +---------+----------+
      |              |                |                    |
      |              v                |                    |
      |     +------------------+      |                    |
      |     |    connectors    |      |                    |
      |     | (Adapter contract|      |                    |
      |     |  + 4 v1 stubs)   |      |                    |
      |     +--------+---------+      |                    |
      |              |                |                    |
      +--------------+----------------+--------------------+
                                      |
                                      v
+----------------------------------------------------------------------+
|  storage (SQLite WAL repositories + SHA-256 local blob store)        |
+----------------------------------------------------------------------+
|  shared (Zod schemas, domain types, ULID/hash utils, error types)    |
+----------------------------------------------------------------------+
```

### Module Responsibilities & Ownership Boundaries

| Module | Owns | Must NOT Own |
| :--- | :--- | :--- |
| `shared` | Domain types, Zod schemas, `appcode` regex, human vocabulary constants, error codes | I/O, DB connections, HTTP routing |
| `storage` | SQLite migrations, repository implementations, SHA-256 content-addressed blob read/write | Sync policy, connector calls, HTTP concerns |
| `manifest` | Parsing/validating `appcode` manifests (YAML/JSON), default stage-ownership templates, secret-reference validation (rejects inline secrets) | External API calls, snapshot mutation |
| `connectors` | `ConnectorAdapter` interface, adapter registry, v1 stub adapters (`confluence`, `sharepoint`, `git`, `testing`), fixture loader, normalization to readable Markdown/JSON | Writing directly to DB, deciding whether a change is canonical or drift |
| `ownership` | Evaluating which system owns truth for `(project, artifact, stage)`, ingesting connector payloads, deduplicating by content hash, raising/resolving `DriftAlert` records | UI rendering, direct HTTP routing |
| `timeline` | Creating immutable `Snapshot` + `SnapshotItem` records, numbering project/artifact versions, generating human-readable summaries & text diffs, non-destructive `restore` workflow | Polling external connectors directly |
| `integrations/stage-gate` | Computing gate-readiness checklists, atomic `stage-transition` sealing (`stage_seal` snapshot + epoch increment), optional outbound HMAC webhook delivery | Hard-requiring a live `stage-gate` instance to boot |
| `api` | Hono routes (`/api/v1/*`), request validation, error serialization, static asset hosting for `ui`, dev simulator endpoints (behind env flag) | Business logic, direct SQL queries |
| `ui` | Project selector, human-readable timeline, side-by-side readable diff viewer, "Where to edit now" ownership badge, drift review drawer, standalone stage switcher | Connector secrets, direct DB access |

---

## 3. Appcode Project Manifest (`appcode-xyz-0`)

Every tracked initiative is anchored by a canonical **Appcode Project ID** matching `^[a-z0-9]+-[a-z0-9]+-[0-9]+$` (for example, `appcode-xyz-0`). The manifest is declarative YAML or JSON, versionable in a project repo or registered via `POST /api/v1/projects`.

### Manifest Contract

- **Identity:** `projectId`, `displayName`, `ownerTeam`, `description`.
- **Connector bindings (`systems`):** Maps logical tool roles (`confluence`, `sharepoint`, `git`, `testing`) to external locators and `mode: "stub" | "live"`. Credentials are **never** stored in manifests—only environment variable references (`authEnvRef`), validated by the manifest loader to reject raw tokens/passwords.
- **Logical artifacts (`artifacts`):** Human-named deliverables tracked across stages (e.g., `hlr`, `fr-nfr`, `adr`, `spec`, `code-release`, `test-evidence`), with locator mappings into each relevant external system.
- **Stage ownership policy (`stageOwnership`):** Declares the single authoritative system per artifact class in each workflow stage, read-only shadow targets, and capture policy.

### Example Manifest (`fixtures/manifests/appcode-xyz-0.yaml`)

```yaml
schemaVersion: "1.0"
projectId: "appcode-xyz-0"
displayName: "Customer Self-Service Intake"
ownerTeam: "Operations Enablement"
description: "Track requirements, build specs, and UAT evidence across tools."

initialStage: "pre-requirements"

systems:
  confluence:
    mode: "stub"
    displayLabel: "Ops Wiki (Confluence)"
    locator:
      spaceKey: "OPS"
      rootPageId: "104829"
    fixtureDir: "fixtures/confluence/appcode-xyz-0"
  sharepoint:
    mode: "stub"
    displayLabel: "Governance Library (SharePoint)"
    locator:
      siteName: "ops-governance"
      driveName: "ProjectDocs"
      folderPath: "/appcode-xyz-0"
    fixtureDir: "fixtures/sharepoint/appcode-xyz-0"
  git:
    mode: "stub"
    displayLabel: "Service Repo (GitHub)"
    locator:
      provider: "github"
      repo: "Mirevox/example-intake-service"
      defaultBranch: "main"
    fixtureDir: "fixtures/git/appcode-xyz-0"
  testing:
    mode: "stub"
    displayLabel: "QA Suite (Test Platform)"
    locator:
      provider: "junit-stub"
      suiteKey: "INTAKE-E2E"
    fixtureDir: "fixtures/testing/appcode-xyz-0"

artifacts:
  - key: "hlr"
    displayName: "High-Level Requirements"
    artifactClass: "business-doc"
    bindings:
      confluence: { externalId: "page-hlr-01" }
      sharepoint: { externalId: "doc-business-case-01" }
  - key: "fr-nfr"
    displayName: "Functional & Non-Functional Requirements"
    artifactClass: "requirements-doc"
    bindings:
      confluence: { externalId: "page-fr-nfr-02" }
      git: { externalId: "docs/requirements-snapshot.md" }
  - key: "adr"
    displayName: "Architecture Decisions"
    artifactClass: "technical-spec"
    bindings:
      git: { externalId: "docs/adr/001-intake-flow.md" }
      confluence: { externalId: "page-adr-mirror-03" }
  - key: "test-evidence"
    displayName: "Verification & UAT Evidence"
    artifactClass: "test-evidence"
    bindings:
      testing: { externalId: "suite-intake-e2e" }
      sharepoint: { externalId: "doc-uat-signoff-04" }

stageOwnership:
  pre-requirements:
    capturePolicy: "on-poll"
    requiredArtifacts: ["hlr"]
    owners:
      business-doc: "confluence"
      requirements-doc: "confluence"
      technical-spec: "confluence"
      test-evidence: "testing"
    shadowTargets:
      business-doc: ["sharepoint"]
  requirements:
    capturePolicy: "on-stage-gate"
    requiredArtifacts: ["hlr", "fr-nfr"]
    owners:
      business-doc: "sharepoint"
      requirements-doc: "confluence"
      technical-spec: "git"
      test-evidence: "testing"
    shadowTargets:
      requirements-doc: ["git"]
  build:
    capturePolicy: "on-poll"
    requiredArtifacts: ["fr-nfr", "adr"]
    owners:
      business-doc: "sharepoint"
      requirements-doc: "confluence"
      technical-spec: "git"
      test-evidence: "testing"
    shadowTargets:
      technical-spec: ["confluence"]
  verification:
    capturePolicy: "on-stage-gate"
    requiredArtifacts: ["adr", "test-evidence"]
    owners:
      business-doc: "sharepoint"
      requirements-doc: "confluence"
      technical-spec: "git"
      test-evidence: "testing"
    shadowTargets:
      test-evidence: ["sharepoint"]
  release:
    capturePolicy: "manual"
    requiredArtifacts: ["hlr", "fr-nfr", "adr", "test-evidence"]
    owners:
      business-doc: "sharepoint"
      requirements-doc: "confluence"
      technical-spec: "git"
      test-evidence: "testing"
```

---

## 4. Human-Readable Snapshot Timeline (Not Git Verbs)

### Vocabulary Contract

UI components, API summary strings, and docs enforce a strict translation boundary:

| Banned Git / SCM Term | `shadow-versioning` Human Term | Underlying Implementation |
| :--- | :--- | :--- |
| Commit / SHA | **Version** (`v1`, `v2`, ...) / **Snapshot** | Immutable `snapshots` row + internal ULID + SHA-256 blob |
| Branch / HEAD | **Active Working Copy** / **Current Stage** | Current `stage_epoch` + active owner pointer |
| Tag / Release commit | **Stage Milestone** / **Sealed Handoff** | `kind: "stage_seal"` immutable snapshot |
| Diff (`git diff -u`) | **What Changed** (readable side-by-side / section summary) | Line/section diff on normalized Markdown/JSON text |
| Merge conflict | **Out-of-Stage Edit (Needs Review)** | `DriftAlert` record with plain-English explanation |
| Revert / `git reset` | **Restore Earlier Version** | New forward `kind: "restore_point"` snapshot + owner handoff note (history is never rewritten) |
| Pull / Fetch | **Check for Updates** / **Sync** | Unidirectional connector poll |

### Snapshot Kinds

1. `auto_capture` — Recorded automatically when a poll or webhook sees a new content hash from the current authoritative owner.
2. `manual_checkpoint` — Named checkpoint triggered by a human (*"Pre-steering-committee review"*), capturing all bound artifacts at once.
3. `stage_seal` — Immutable milestone sealed when `stage-gate` (or the standalone stage switcher) advances a project from one stage to the next.
4. `restore_point` — Forward snapshot created when a user restores an older version, recording `restoredFromSnapshotId` and the human rationale.
5. `external_evidence` — Attached test run or sign-off record linked to the active build/release version.

### Plain-English Change Summaries

Each `SnapshotItem` stores a normalized UTF-8 representation (Markdown for docs/specs, structured JSON for test runs) plus computed human metadata:
- For prose/specs: headings touched, lines added/removed, plain sentence summary (e.g., *"Updated 'Authentication Rules' (+12 lines, -3 lines) in Confluence"*).
- For test evidence: pass/fail/skipped counts and delta vs prior snapshot (e.g., *"44/44 checks passing (+2 fixed since v5)"*).
- External provenance (`externalUrl`, `externalRev`, e.g., Confluence version `14`, SharePoint `eTag`, Git short ref) is shown cleanly as a clickable *"Open original in Confluence"* link—never as a primary identifier.

---

## 5. Stage-Owned Sync Model (Preventing Dual-Write Chaos)

### Core Rule: Single Authoritative Writer per Stage

For any project `P`, artifact `A`, and active stage `S`, `ownership.resolveOwner(P, A, S)` returns **exactly one** authoritative system `O`.

```text
  [Authoritative Owner O]         [Non-Owner / Shadow System X]
  e.g. Confluence in Requirements  e.g. Git mirror or SharePoint copy
            |                                    |
            | poll / webhook                     | poll / webhook
            v                                    v
   +----------------------------------------------------+
   |       shadow-versioning: Ownership Engine          |
   |                                                    |
   |  1. Normalize payload -> compute contentHash       |
   |  2. Unchanged vs last seen hash? -> NO-OP          |
   |  3. Source == Owner O?                             |
   |       YES -> Append immutable Snapshot (vN+1)      |
   |              Optionally emit read-only projection  |
   |       NO  -> DO NOT overwrite Owner O or System X! |
   |              Record DriftAlert (open)              |
   |              Surface human review action           |
   +----------------------------------------------------+
```

### Five Invariants That Prevent Dual-Write Chaos

1. **No silent bidirectional writes.** `shadow-versioning` never writes edits from System A into System B automatically. At most, on `stage_seal`, it can generate a clearly watermarked read-only export artifact (*"Read-only snapshot from Confluence v14 — make edits in Confluence"*) for downstream consumers/agents.
2. **Idempotent content-hash deduplication.** Re-polling an unchanged Confluence page, SharePoint document, Git path, or test suite hashes to the identical `contentHash` + `externalRev` and creates **zero** duplicate snapshots.
3. **Out-of-stage / non-owner edits become explicit `DriftAlert`s.** Suppose a project advances from `requirements` to `build` (where Git owns `adr` and `fr-nfr` is frozen for the build baseline), and someone edits the Confluence page out-of-band, or edits a read-only exported Markdown copy in Git. Instead of overwriting either side:
   - `ownership` records a `DriftAlert` (`status: "open"`, `severity: "blocking" | "advisory"`).
   - The timeline displays a clear banner: *"Change detected in Git for Functional Requirements while Confluence is the source of truth."*
   - A human resolves it via one of three explicit actions:
     - `acknowledge_and_adopt` — capture the change as a new amendment snapshot and log why;
     - `dismiss_keep_owner` — ignore the shadow copy edit and keep the authoritative version;
     - `defer_to_amendment` — mark as known follow-up for the next stage/iteration.
4. **Monotonic `stageEpoch` & atomic handoff seals.** Advancing a stage increments `projects.stage_epoch` inside a single SQLite transaction, binds a `stage_seal` snapshot to the closing epoch, and switches active ownership rules to the new stage. Late-arriving events from a previous epoch cannot silently overwrite the new stage's baseline.
5. **Append-only restores.** "Restore Earlier Version" creates a new forward `restore_point` snapshot and generates a copy-paste / exportable restoration bundle for the active authoritative system. History is never truncated or force-pushed.

---

## 6. Connector Architecture & Honest Stub-vs-Real Matrix

All external platforms sit behind a single TypeScript interface (`src/connectors/types.ts`):

```ts
export type SystemType = "confluence" | "sharepoint" | "git" | "testing";

export interface ConnectorCapabilities {
  mode: "stub" | "local-readonly" | "live";
  supportsPoll: boolean;
  supportsWebhook: boolean;
  supportsReadOnlyProjection: boolean;
  supportsDeepLinks: boolean;
}

export interface NormalizedArtifactPayload {
  artifactKey: string;
  sourceSystem: SystemType;
  externalId: string;
  externalRev: string;          // Opaque native rev (e.g. "v14", eTag, commit ref, runId)
  externalUrl: string;          // Human clickable link (or local fixture URI in stub mode)
  title: string;
  mimeType: "text/markdown" | "application/json" | "text/plain";
  normalizedText: string;       // Canonical UTF-8 text/JSON used for hashing & human diffs
  contentHash: string;          // sha256(normalizedText)
  actorName: string;
  actorRole?: string;
  modifiedAt: string;           // ISO-8601
  metadata: Record<string, unknown>;
}

export interface ConnectorAdapter {
  readonly systemType: SystemType;
  readonly capabilities: ConnectorCapabilities;
  healthCheck(binding: ConnectorBinding): Promise<{ ok: boolean; detail: string }>;
  fetchLatest(
    binding: ConnectorBinding,
    artifactKey: string,
    externalId: string
  ): Promise<NormalizedArtifactPayload | null>;
  listRevisions?(
    binding: ConnectorBinding,
    artifactKey: string,
    externalId: string
  ): Promise<Array<{ externalRev: string; modifiedAt: string; actorName: string; note?: string }>>;
  ingestWebhook?(
    binding: ConnectorBinding,
    headers: Record<string, string>,
    body: unknown
  ): Promise<NormalizedArtifactPayload[]>;
}
```

### Honest v1 Implementation Matrix (Stubs vs Real)

| Connector | v1 Implementation | What Works Out of the Box in v1 | What Is Explicitly Stubbed / Deferred to v2 |
| :--- | :--- | :--- | :--- |
| **Confluence** | `ConfluenceStubConnector` (**Stub**) | Reads versioned page fixtures from `fixtures/confluence/`, supports simulated edits via `/api/v1/dev/simulate-change`, normalizes to Markdown, computes hashes & human diffs. | No Atlassian Cloud/DC OAuth, no live `/wiki/api/v2/pages` HTTP calls, no live XHTML storage-format parser. |
| **SharePoint** | `SharePointStubConnector` (**Stub**) | Reads document-library fixture metadata + extracted text summaries + simulated `eTag` revisions from `fixtures/sharepoint/`. | No Microsoft Graph OAuth/MSAL, no live DriveItem subscriptions, no binary `.docx`/`.pdf` extraction or visual diffing. |
| **Git (GitHub / Bitbucket)** | `GitStubConnector` (**Stub**, default) + optional `LocalGitReadConnector` (**Local Read-Only**) | Default stub serves deterministic repo file revisions & translates commit metadata into plain English. Optional local read-only mode can inspect files on disk in a checked-out directory without network auth. | No GitHub/Bitbucket OAuth Apps, no remote API polling, no PR creation, no git push/write-back. |
| **Testing Platforms** | `TestingStubConnector` (**Stub** + **Real Local JUnit/JSON File Ingest**) | Reads structured test run results (pass/fail/skipped, failing case names, run links) from `fixtures/testing/` **and** can ingest a real local JSON/JUnit summary file dropped into the configured fixture path. | No live TestRail, Xray, Zephyr Scale, or GitHub Actions Checks API clients. |

**Why this honesty matters:** Every API response (`GET /api/v1/health`, `GET /api/v1/connectors`, UI badges) explicitly displays `mode: "stub"` alongside each connector so nobody mistakes simulated fixture data for live SaaS sync. Replacing a stub with a real v2 connector requires implementing only `ConnectorAdapter` and switching `mode: "live"` + `authEnvRef` in the manifest—zero changes to `ownership`, `timeline`, `storage`, `api`, or `ui`.

---

## 7. Conceptual Integration API with `stage-gate`

`shadow-versioning` and `stage-gate` are separate repositories that run either standalone or composed on the same network. They share four lightweight identifiers: `projectId` (`appcode-xyz-0`), `stageId`, `artifactKey`, and `snapshotId`.

### Inbound: `stage-gate` → `shadow-versioning`

1. **Gate Readiness Check (before allowing a stage advance):**
   `GET /api/v1/projects/:projectId/gate-readiness?stage=requirements&substage=fr-nfr`
   - `stage-gate` calls this to answer *"Are the required artifacts captured and free of unresolved drift?"*
   - Response:
     ```json
     {
       "projectId": "appcode-xyz-0",
       "stageId": "requirements",
       "stageEpoch": 2,
       "ready": false,
       "requiredArtifacts": [
         {
           "artifactKey": "hlr",
           "displayName": "High-Level Requirements",
           "ownerSystem": "sharepoint",
           "capturedInEpoch": true,
           "latestSnapshotId": "01J...",
           "latestVersionNumber": 4
         },
         {
           "artifactKey": "fr-nfr",
           "displayName": "Functional & Non-Functional Requirements",
           "ownerSystem": "confluence",
           "capturedInEpoch": false,
           "latestSnapshotId": null,
           "latestVersionNumber": null
         }
       ],
       "openDriftAlerts": [
         {
           "id": "drift_01J...",
           "artifactKey": "hlr",
           "severity": "blocking",
           "summary": "Edited in Confluence while SharePoint owns High-Level Requirements."
         }
       ],
       "blockingReasons": [
         "Missing snapshot for 'Functional & Non-Functional Requirements' in current stage.",
         "1 blocking out-of-stage edit must be reviewed before advancing."
       ]
     }
     ```

2. **Stage Transition & Milestone Seal (when a gate passes):**
   `POST /api/v1/projects/:projectId/stage-transitions` (requires `Idempotency-Key` header)
   - Request:
     ```json
     {
       "fromStage": "requirements",
       "toStage": "build",
       "substage": "adr",
       "initiatedBy": "Priya Patel",
       "gateDecisionRef": "sg-gate-0042",
       "note": "FR/NFR approved by Operations & Engineering",
       "forceIgnoreBlockingDrift": false
     }
     ```
   - Behavior: Runs a final sync of authoritative owners, verifies no unresolved blocking drift (unless `forceIgnoreBlockingDrift: true` with audit note), atomically creates an immutable `stage_seal` snapshot, increments `stageEpoch`, updates active stage ownership to `toStage`, and returns `{ transitionId, sealSnapshotId, versionNumber, newStage, newEpoch, timelineUrl }`.

3. **Embedded Timeline Drawer Feed:**
   `GET /api/v1/projects/:projectId/timeline?stage=requirements&limit=10&view=compact`
   - Lets `stage-gate` render recent human-readable versions directly inside its stage stepper UI without duplicating persistence.

### Outbound: `shadow-versioning` → `stage-gate` (Optional)

- Enabled only when `STAGE_GATE_WEBHOOK_URL` is configured (no-op when unset so `shadow-versioning` runs completely standalone).
- Emits signed JSON payloads (`X-Mirevox-Event`, `X-Mirevox-Signature: sha256=...` when `STAGE_GATE_WEBHOOK_SECRET` is set) with bounded retries logged in `webhook_deliveries`:
  - `snapshot.recorded`
  - `drift.detected`
  - `drift.resolved`
  - `stage.sealed`

---

## 8. REST API Sketch (`/api/v1`)

All endpoints accept/return JSON, validate payloads with Zod, and use consistent `{ error: { code, message, details? } }` error envelopes.

| Method & Path | Purpose |
| :--- | :--- |
| `GET /api/v1/health` | Service status, SQLite connectivity, loaded connectors & stub/live modes |
| `GET /api/v1/connectors` | List registered connector adapters and declared capabilities |
| `GET /api/v1/projects` | List all `appcode-*` projects with current stage, version count, open drift count |
| `POST /api/v1/projects` | Register a new project from a manifest (JSON or YAML) |
| `GET /api/v1/projects/:projectId` | Get project summary, manifest, active stage ownership map, current `stageEpoch` |
| `PUT /api/v1/projects/:projectId/manifest` | Validate and update manifest bindings or stage-ownership policy |
| `POST /api/v1/projects/:projectId/sync` | Poll configured connectors; capture owner updates as snapshots, flag non-owner edits as drift (`?dryRun=true` supported) |
| `POST /api/v1/projects/:projectId/checkpoints` | Create a named human checkpoint (`manual_checkpoint`) across current bound artifacts |
| `GET /api/v1/projects/:projectId/timeline` | Paginated human-readable timeline; filter by `stage`, `artifactKey`, `kind`, `originSystem`, `q`, `view=compact\|full` |
| `GET /api/v1/projects/:projectId/snapshots/:snapshotId` | Full snapshot detail: items, readable content, provenance links, actor, summary |
| `GET /api/v1/projects/:projectId/compare` | Compare two versions (`?from=<id>&to=<id>&artifact=<key>`); returns human diff hunks + summary stats |
| `POST /api/v1/projects/:projectId/snapshots/:snapshotId/restore` | Create a non-destructive forward `restore_point` snapshot + restoration handoff payload for the current owner |
| `GET /api/v1/projects/:projectId/drift` | List drift alerts (`?status=open\|resolved`) |
| `POST /api/v1/projects/:projectId/drift/:driftId/resolve` | Resolve a drift alert (`acknowledge_and_adopt`, `dismiss_keep_owner`, `defer_to_amendment`) with required rationale |
| `GET /api/v1/projects/:projectId/gate-readiness` | `stage-gate` readiness query (`?stage=<id>&substage=<id>`) |
| `POST /api/v1/projects/:projectId/stage-transitions` | Idempotent stage advance + `stage_seal` snapshot + ownership handoff |
| `POST /api/v1/connectors/:systemType/webhooks` | Inbound webhook receiver for connector events (accepts simulated payloads in stub mode) |
| `POST /api/v1/dev/simulate-change` | *(Enabled only when `SHADOW_ENABLE_SIMULATOR=true`)* Mutate a stub fixture revision in Confluence/SharePoint/Git/Testing to demonstrate sync, timeline capture, and out-of-stage drift |

---

## 9. Data Model (SQLite + Content-Addressed Blobs)

v1 uses **SQLite (WAL mode, foreign keys enabled)** for structured metadata and a **content-addressed local blob store** (`$DATA_DIR/blobs/<first-2-hex>/<sha256>`) for immutable normalized artifact text/JSON. This gives ACID transactions for stage transitions, zero external container dependencies, trivial backups, and a clean repository boundary if Postgres + S3 are added later.

### Core Tables

```sql
CREATE TABLE projects (
  id                TEXT PRIMARY KEY,        -- e.g. 'appcode-xyz-0'
  display_name      TEXT NOT NULL,
  owner_team        TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  current_stage     TEXT NOT NULL,
  current_substage  TEXT,
  stage_epoch       INTEGER NOT NULL DEFAULT 1,
  manifest_json     TEXT NOT NULL,           -- Validated canonical JSON manifest
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE connector_bindings (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  system_type       TEXT NOT NULL,           -- confluence | sharepoint | git | testing
  mode              TEXT NOT NULL,           -- stub | local-readonly | live
  display_label     TEXT NOT NULL,
  config_json       TEXT NOT NULL,           -- Locators & env var refs only (no raw secrets)
  last_synced_at    TEXT,
  UNIQUE(project_id, system_type)
);

CREATE TABLE artifacts (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_key          TEXT NOT NULL,       -- e.g. 'fr-nfr', 'adr', 'test-evidence'
  display_name          TEXT NOT NULL,
  artifact_class        TEXT NOT NULL,       -- business-doc | requirements-doc | technical-spec | test-evidence
  latest_snapshot_id    TEXT,
  latest_content_hash   TEXT,
  latest_external_rev   TEXT,
  latest_version_number INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT NOT NULL,
  UNIQUE(project_id, artifact_key)
);

CREATE TABLE snapshots (
  id                        TEXT PRIMARY KEY, -- ULID
  project_id                TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number            INTEGER NOT NULL, -- Monotonic 1, 2, 3... per project
  kind                      TEXT NOT NULL,    -- auto_capture | manual_checkpoint | stage_seal | restore_point | external_evidence
  stage_id                  TEXT NOT NULL,
  substage_id               TEXT,
  stage_epoch               INTEGER NOT NULL,
  title                     TEXT NOT NULL,    -- Human-readable headline
  summary                   TEXT NOT NULL,    -- Plain-English change summary
  actor_name                TEXT NOT NULL,
  actor_role                TEXT,
  origin_system             TEXT NOT NULL,    -- confluence | sharepoint | git | testing | shadow-ui | stage-gate
  parent_snapshot_id        TEXT REFERENCES snapshots(id),
  restored_from_snapshot_id TEXT REFERENCES snapshots(id),
  created_at                TEXT NOT NULL,
  UNIQUE(project_id, version_number)
);

CREATE TABLE snapshot_items (
  id                  TEXT PRIMARY KEY,
  snapshot_id         TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  artifact_key        TEXT NOT NULL,
  artifact_version    INTEGER NOT NULL,       -- Monotonic per (project, artifact_key)
  source_system       TEXT NOT NULL,
  external_id         TEXT NOT NULL,
  external_rev        TEXT NOT NULL,
  external_url        TEXT NOT NULL,
  content_hash        TEXT NOT NULL,          -- SHA-256 hex -> resolves blob on disk
  blob_path           TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  change_summary_json TEXT NOT NULL,          -- { linesAdded, linesRemoved, sectionsChanged, testCounts? }
  metadata_json       TEXT NOT NULL
);

CREATE TABLE drift_alerts (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_key          TEXT NOT NULL,
  stage_id              TEXT NOT NULL,
  stage_epoch           INTEGER NOT NULL,
  expected_owner_system TEXT NOT NULL,
  detected_system       TEXT NOT NULL,
  detected_external_rev TEXT NOT NULL,
  detected_content_hash TEXT NOT NULL,
  detected_blob_path    TEXT NOT NULL,
  severity              TEXT NOT NULL,        -- blocking | advisory
  status                TEXT NOT NULL,        -- open | resolved
  summary               TEXT NOT NULL,        -- Human-readable explanation
  resolution_action     TEXT,                 -- acknowledge_and_adopt | dismiss_keep_owner | defer_to_amendment
  resolution_note       TEXT,
  resolved_by           TEXT,
  created_at            TEXT NOT NULL,
  resolved_at           TEXT
);

CREATE TABLE stage_transitions (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  idempotency_key   TEXT NOT NULL UNIQUE,
  from_stage        TEXT NOT NULL,
  to_stage          TEXT NOT NULL,
  from_epoch        INTEGER NOT NULL,
  to_epoch          INTEGER NOT NULL,
  seal_snapshot_id  TEXT NOT NULL REFERENCES snapshots(id),
  initiated_by      TEXT NOT NULL,
  gate_decision_ref TEXT,
  note              TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL
);

CREATE TABLE webhook_deliveries (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  target_url   TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status       TEXT NOT NULL,                 -- pending | delivered | failed
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
```

---

## 10. Stack Selection & `/workspace` Directory Layout

### Recommended Stack: TypeScript + Hono API + React (Vite) UI

**Why Hono + Vite/React instead of Next.js for v1:**
- `shadow-versioning` is primarily a control-plane service consumed over HTTP by `stage-gate`, local harnesses, and human browsers.
- Hono runs on Node 22 with tiny memory overhead, native Web Standards `Request`/`Response` (making integration tests fast via `app.request()` without binding ports), and zero SSR/App-Router complexity.
- In production/Docker, the compiled Vite UI (`dist/ui`) is served statically by the same Hono process—one binary, one port (`4100`), fast builds on a cloud VM.
- Because the UI talks exclusively to `/api/v1/*`, swapping or embedding the UI inside a Next.js portal later requires zero API changes.

**Core dependencies (minimal):**
- Runtime: `node` (v22+), `hono`, `@hono/node-server`, `zod`, `better-sqlite3` (or Node 22 built-in `node:sqlite` if native addon builds are avoided—**recommendation: `better-sqlite3` for mature synchronous WAL reliability, or fallback to `node:sqlite` if build toolchain is absent**), `yaml`, `ulid`, `diff` (for readable line/word diffs).
- UI: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, lightweight CSS (dark purple + neon blue Mirevox palette, clean typography, no bloated component framework required).
- Test: `vitest` (fast TypeScript unit + Hono HTTP integration tests).

### Suggested `/workspace` Layout

Aligned with the existing `/workspace/{docs,fixtures,src,tests}` directories:

```text
/workspace
├── docs/
│   ├── problem-opportunity.md
│   ├── requirements.md
│   ├── architecture.md
│   ├── market-gap.md
│   └── devils-advocate.md
├── fixtures/
│   ├── manifests/
│   │   └── appcode-xyz-0.yaml
│   ├── confluence/
│   │   └── appcode-xyz-0/
│   │       ├── page-hlr-01.json
│   │       └── page-fr-nfr-02.json
│   ├── sharepoint/
│   │   └── appcode-xyz-0/
│   │       ├── doc-business-case-01.json
│   │       └── doc-uat-signoff-04.json
│   ├── git/
│   │   └── appcode-xyz-0/
│   │       └── adr-001-intake-flow.json
│   └── testing/
│       └── appcode-xyz-0/
│           └── suite-intake-e2e.json
├── src/
│   ├── index.ts                      # Process entrypoint (boots DB, seeds optional demo fixture, starts Hono)
│   ├── shared/
│   │   ├── types.ts                  # Core domain interfaces
│   │   ├── schemas.ts                # Zod request/manifest/event schemas
│   │   ├── vocabulary.ts             # Human-readable labels & banned-Git-verb helpers
│   │   └── errors.ts                 # Typed AppError -> HTTP status mapping
│   ├── storage/
│   │   ├── db.ts                     # SQLite connection, WAL pragma, schema migrations
│   │   ├── blob-store.ts             # SHA-256 content-addressed file storage with path-traversal guard
│   │   └── repositories.ts           # Project, Snapshot, Artifact, Drift, Transition repos
│   ├── manifest/
│   │   ├── parser.ts                 # YAML/JSON parser + Zod validation + secret-leak rejection
│   │   └── templates.ts              # Default SDLC stage-ownership templates
│   ├── connectors/
│   │   ├── types.ts                  # ConnectorAdapter interface
│   │   ├── registry.ts               # Adapter lookup by systemType + mode
│   │   ├── stub-state.ts             # Mutable in-memory/file overlay for simulator & fixture reads
│   │   ├── confluence-stub.ts
│   │   ├── sharepoint-stub.ts
│   │   ├── git-stub.ts
│   │   └── testing-stub.ts           # Supports fixture JSON + real local JUnit/JSON report file
│   ├── ownership/
│   │   ├── policy.ts                 # Resolves single authoritative owner for (project, artifact, stage)
│   │   ├── sync-engine.ts            # Poll -> hash dedup -> snapshot OR drift alert
│   │   └── drift-service.ts          # Drift listing & human resolution workflows
│   ├── timeline/
│   │   ├── snapshot-service.ts       # Append-only snapshot & manual checkpoint creation
│   │   ├── diff-service.ts           # Human-readable section/line diff & test-delta formatter
│   │   └── restore-service.ts        # Safe forward restore_point + owner handoff bundle
│   ├── integrations/
│   │   └── stage-gate.ts             # Gate-readiness evaluator, atomic stage transition, optional outbound webhooks
│   ├── api/
│   │   ├── app.ts                    # Hono app factory (injectable deps for zero-port tests)
│   │   └── routes/
│   │       ├── health.ts
│   │       ├── projects.ts
│   │       ├── sync.ts
│   │       ├── timeline.ts
│   │       ├── drift.ts
│   │       ├── stage-gate.ts
│   │       └── simulator.ts          # Gated by SHADOW_ENABLE_SIMULATOR
│   └── ui/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx                   # Project shell + current stage + "Where to edit now" strip
│       ├── api-client.ts             # Typed fetch wrapper for /api/v1/*
│       ├── styles.css                # Mirevox dark purple + neon blue theme
│       └── components/
│           ├── ProjectHeader.tsx     # appcode badge, stage badge, Sync & Checkpoint buttons
│           ├── OwnershipMap.tsx      # Clear table: artifact -> "Edit here right now" tool + stub badge
│           ├── TimelineFeed.tsx      # Human-readable version stream (filters, milestone seals)
│           ├── SnapshotDiffModal.tsx # Plain-English side-by-side comparison + safe Restore button
│           ├── DriftBanner.tsx       # Out-of-stage edit review & 3-option human resolution
│           └── SimulatorPanel.tsx    # Optional demo drawer to simulate Confluence/Git/Test edits
├── tests/
│   ├── helpers/
│   │   └── test-app.ts               # Ephemeral temp-dir SQLite + Hono test harness
│   ├── unit/
│   │   ├── manifest.test.ts
│   │   ├── ownership-policy.test.ts
│   │   ├── diff-service.test.ts
│   │   └── connectors.test.ts
│   └── integration/
│       ├── sync-and-timeline.test.ts
│       ├── drift-prevention.test.ts
│       ├── restore-non-destructive.test.ts
│       └── stage-gate-handoff.test.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE
```

---

## 11. Docker-Friendly & Cloud-VM Deployment

### Cloud VM (No Docker Required — Primary v1 Dev/Test Path)

```bash
npm install
npm run seed:demo   # Loads fixtures/manifests/appcode-xyz-0.yaml into local ./data
npm run dev         # Runs Hono API (:4100) + Vite UI (:5173 proxying /api -> :4100)
npm test            # Runs Vitest unit + HTTP integration suite against temp SQLite dirs
```

### Containerized Deployment (Single Service, Homelab-Ready)

- **Multi-stage `Dockerfile`** (`node:22-alpine`):
  1. `builder` stage compiles TypeScript (`dist/server`) and Vite bundle (`dist/ui`).
  2. `runtime` stage installs production dependencies, copies `dist/` and `fixtures/`, exposes port `4100`, mounts `/data` as the sole persistent volume (`shadow.db` + `blobs/`), and includes a `HEALTHCHECK` against `GET /api/v1/health`.
- **`docker-compose.yml`**:
  - Runs `shadow-versioning` standalone with `PORT=4100`, `DATA_DIR=/data`, `SHADOW_ENABLE_SIMULATOR=true` (toggleable to `false`), and `STAGE_GATE_WEBHOOK_URL=""` (optional).
  - Includes a commented external network stanza (`mirevox-control-plane`) so the homelab compose stack can attach `shadow-versioning` beside `stage-gate`, `smart-router`, and `context-engine` without requiring the full homelab stack to boot during development.

### Configuration Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `4100` | HTTP port for API + static UI |
| `DATA_DIR` | `./data` | Directory holding `shadow.db` and `blobs/` |
| `FIXTURES_DIR` | `./fixtures` | Root directory for stub connector fixtures |
| `SHADOW_ENABLE_SIMULATOR` | `true` (dev) / `false` (prod) | Enables `/api/v1/dev/simulate-change` demo endpoint |
| `STAGE_GATE_WEBHOOK_URL` | *(empty)* | Optional outbound webhook URL to Mirevox `stage-gate` |
| `STAGE_GATE_WEBHOOK_SECRET` | *(empty)* | Optional HMAC-SHA256 signing secret for outbound webhooks |

---

## 12. Security Guardrails & Explicit Non-Goals (v1)

### Security Guardrails Built Into v1
- **No raw secrets in manifests or DB:** Manifest validation rejects keys named `token`, `password`, `secret`, `apiKey` inside `locator`/`config`; live v2 connectors resolve credentials exclusively from env var names (`authEnvRef`).
- **Path-traversal protection:** `projectId` (`^[a-z0-9]+-[a-z0-9]+-[0-9]+$`) and blob hashes (`^[a-f0-9]{64}$`) are strictly validated before any filesystem path join.
- **Idempotency & immutability:** `stage-transitions` requires `Idempotency-Key`; snapshots and blob files are write-once, never mutated in place.
- **Explicit stub labeling:** Simulator endpoints are disabled when `SHADOW_ENABLE_SIMULATOR=false`, and connector responses always declare `mode: "stub"`.

### Explicit Non-Goals for v1
- Live OAuth / SaaS token management for Atlassian, Microsoft 365, GitHub, Bitbucket, or TestRail.
- Automatic bidirectional write-back between external tools.
- Binary Word (`.docx`), Excel, or PDF visual diffing (v1 compares normalized text/Markdown/JSON summaries).
- Multi-tenant RBAC / SSO (expected to sit behind a reverse proxy or Mirevox control-plane auth layer later).
- Distributed multi-node clustering (single SQLite writer is sufficient for v1 and homelab scale).

---

## 13. Parallel Build & Test Decomposition (Council Handoff)

To let parallel builders and testers work concurrently without merge conflicts once requirements are locked:

| Workstream | Directories Owned | Depends On | Key Verification Tests |
| :--- | :--- | :--- | :--- |
| **W1: Foundation & Storage** | `src/shared/`, `src/storage/`, `src/manifest/`, `fixtures/` | Locked requirements | Schema validation, secret-rejection, SQLite migrations, blob dedup & path safety |
| **W2: Connectors & Ownership** | `src/connectors/`, `src/ownership/` | `W1` types/repos | Poll dedup, single-owner capture, non-owner edit -> `DriftAlert`, drift resolution |
| **W3: Timeline & Stage-Gate** | `src/timeline/`, `src/integrations/` | `W1` types/repos | Version numbering, readable diffs, non-destructive restore, gate readiness & atomic `stage_seal` |
| **W4: API & Docker** | `src/api/`, `src/index.ts`, `Dockerfile`, `docker-compose.yml` | `W1–W3` services | Full REST contract via Hono `app.request()`, simulator flag gating, health check |
| **W5: Human Timeline UI** | `src/ui/` | REST contract (can build in parallel against mock/live API) | Zero Git verbs in rendered DOM, ownership badges, diff viewer, drift resolution UX |
