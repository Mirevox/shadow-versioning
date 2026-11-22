# Mirevox Shadow Versioning

**License:** [Apache-2.0](./LICENSE)

## Problem

Project history is split across documents, code, test tools, and release decisions. A reviewer often has to open several systems—and ask an engineer to translate Git—to work out what changed and what evidence a gate used. Shadow Versioning groups those references under one **appcode** and presents a read-only timeline while each source remains authoritative. **This v1 uses local stub data; it does not connect to Confluence, SharePoint, Git, or test services.**

Part of the [Mirevox](https://github.com/Mirevox) open-source control-plane modules. Pairs with **stage-gate** (gate decisions stay there; the ledger lives here).

## One-command Docker standup

```bash
cp .env.example .env   # optional; no secrets required for v1 stubs
docker compose up --build
```

Open http://127.0.0.1:3847 — health: http://127.0.0.1:3847/api/health (`{"status":"ok",...}`).

Data persists in Compose volume `shadow-data` (`MIREVOX_DATA_DIR=/data`). No API tokens are baked into the image.

```bash
docker compose down
npm run docker:up    # alias for compose up --build
```

## Local (without Docker)

```bash
npm install
npm run dev    # http://127.0.0.1:3847
npm test
npm run build && npm start
```

Data defaults to `./data/projects.json` (gitignored; reseeded when missing). Override with `MIREVOX_DATA_DIR`.

## What v1 ships (honest)

| Capability | Status |
| --- | --- |
| Appcode manifests + seed `appcode-demo-0` | Yes |
| Human-readable timeline UI (dark purple / neon-blue) | Yes |
| Four stub connectors (Confluence, SharePoint, Git, testing) | Yes — `[stub/mock]`, zero network |
| Stage-owned sync model (docs + enforcement) | Yes (slice) |
| Stage-gate hook `POST /api/projects/{appcode}/stage-events` | Conceptual |
| `GET /api/health`, Dockerfile, Compose HEALTHCHECK, `.env.example` | Yes |
| Live upstream OAuth/API connectors | **Not in v1** |
| Full FR-01…27 matrix in `docs/requirements.md` | **Aspirational** — see `docs/v1-scope.md` |

## Compose with other modules

| Module | Relationship |
| --- | --- |
| stage-gate | Posts stage advances; owns release decisions |
| smart-router | Future: route connector credentials |
| context-engine | Future: index snapshot text for agents |
| website | Showcase page links here |

## Docs

- `docs/problem-statement.md` — problem we solve
- `docs/problem-opportunity.md` — fuller opportunity brief
- `docs/v1-scope.md` — intentional acceptance cut
- `docs/sync-model.md` — stage ownership as shipped
- `docs/requirements.md` — FR/NFR (aspirational beyond v1-scope)
- `docs/architecture.md` — includes target-state sections; see honesty banner
- `docs/market-gap.md`
- `docs/devils-advocate.md`
- `docs/known-gaps.md` — production / validation honesty

## License

Copyright 2026 Mirevox contributors. Licensed under the Apache License, Version 2.0 — see [`LICENSE`](./LICENSE).

## Verification

Test suite, smoke test, and container verification results are recorded in [`VERIFICATION.md`](./VERIFICATION.md).
