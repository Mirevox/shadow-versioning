# Stage-owned sync model (as shipped)

This matches `/workspace/src/lib/sync-model.ts` and the in-app page `/docs/sync-model`.  
It is **not** the aspirational Hono/SQLite design sketched in parts of `docs/architecture.md`.

## Rule

Each workflow stage has exactly one owning source. Shadow versioning **records** a snapshot from that owner. It never writes back upstream and never dual-writes the same change into a second system.

## Default ownership map

| Stage | Owner source | Why |
| --- | --- | --- |
| `pre-requirements` | `confluence` | Discovery notes live in wiki pages |
| `requirements` | `sharepoint` | Signed-off requirements are controlled documents |
| `build` | `git` | Source history records what was built |
| `test` | `testing` | Test runs are quality evidence |
| `release` | `stage-gate` | Release approval is decided at the gate |

Code: `DEFAULT_OWNERSHIP` in `src/lib/sync-model.ts`.

## Flow

```text
ProjectManifest (appcode + bindings + ownership)
        │
        ▼
 Stage-owned stub sync / stage-event hook
        │
        ▼
 Connector stubs (zero network)  ──►  SnapshotEvent[]
        │
        ▼
 Append-only JSON ledger (data/projects.json)
        │
        ▼
 Timeline UI (newest by recordedAt, then sequenceNumber)
```

## v1 honesty

- Connectors are stubs (`provenance: "stub"`, `network: false`).
- `POST /api/projects/{appcode}/sync` runs all enabled stub bindings whose stage owner matches.
- `POST /api/projects/{appcode}/stage-events` records a conceptual gate advance without calling stage-gate.
