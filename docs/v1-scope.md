# v1 acceptance scope (intentional cut)

The locked FR/NFR file (`docs/requirements.md`) grew into an aspirational contract (filters, SyncRun, Docker, UI RTL suite, `/api/v1/*`, Hono/SQLite, etc.).

**Runnable v1 for this overnight slice** follows the product synthesis + devil’s-advocate must-keep:

1. Appcode project manifest (`appcode-{slug}-{n}`)
2. Human-readable snapshot timeline (ledger, not live mirror)
3. Four labeled stub connectors (Confluence / SharePoint / Git / testing) with `network: false`
4. Stage-owned sync model documented + enforced on stage snapshots
5. Conceptual stage-gate hook (`POST .../stage-events`) + citation fixture

Acceptance against the full FR-01…27 matrix will remain **partial/fail** until a later milestone. Treat this file as the sign-off bar for the current GitHub push.

See also: `docs/devils-advocate.md`, internal `acceptance.md` / `test-report.md`.
