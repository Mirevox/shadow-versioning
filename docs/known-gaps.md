# Known gaps (validation wave)

Honest inventory after requirements-vs-build + market validation and the production Docker standup pass.  
Sign-off bar for the current push remains `docs/v1-scope.md`, not the full FR-01…27 matrix.

## Production / Docker standup

| Item | Status |
| --- | --- |
| Multi-stage `Dockerfile` (Next standalone, non-root, no secrets) | Present |
| `docker-compose.yml` + named volume + restart policy | Present |
| Container `HEALTHCHECK` → `GET /api/health` | Present |
| `.env.example` (no secrets required for stubs) | Present |
| One-command `docker compose up --build` in README | Present |
| Compose verified on this cloud VM | **Gap** — Docker daemon not installed here; verify on a host with Docker |
| TLS / reverse proxy / authn | **Gap** — bind to trusted network or put behind your own gateway |
| Horizontal scale / HA store | **Gap** — single-node JSON file ledger |

## Product capability gaps vs locked `docs/requirements.md`

- Live connectors, OAuth, and verified upstream provenance (`verified: true`) — stubs only.
- Full SyncRun model, stage-scoped sync routes, multi-facet timeline filters, snapshot delta API — partial / missing.
- Explicit stage-gate link CRUD + outbound emitter — conceptual hook + fixture only.
- UI Empty/Loading/Error matrix + RTL/Playwright suite — incomplete vs FR-20/FR-27.
- Architecture doc still describes a Hono/SQLite aspirational layout in places — treat code + `v1-scope.md` as truth until rewritten.

## Market honesty

v1 demonstrates the **wedge** (appcode + human timeline + stage ownership + stub adapter seam). It does **not** yet beat Polarion/Jama, Azure DevOps, Confluence/SharePoint native history, or Unito on their home turf. Worth shipping as an open overlay demo; not as a regulated ALM substitute. See `docs/market-gap.md`.
