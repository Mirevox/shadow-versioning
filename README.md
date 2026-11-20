# Mirevox Shadow Versioning

Human-readable snapshot timelines bound by an **appcode** (`appcode-demo-0`), so non-technical teammates do not need Git verbs to follow project history.

Part of the [Mirevox](https://github.com/Mirevox) open-source control-plane modules. Pairs with **stage-gate**: stage-gate owns promotion decisions; this module keeps the ledger.

## What v1 ships

- Appcode project manifests with bindings to Confluence, SharePoint, Git, and testing
- File-backed store + seed project `appcode-demo-0`
- Human-readable snapshot timeline UI
- Stub connectors (clearly labelled `[stub/mock]`) — no live upstream calls
- Stage-owned sync model (documented in-app and in `docs/`)
- Conceptual stage-gate hook: `POST /api/projects/{appcode}/stage-events`

## Run locally

```bash
npm install
npm run dev    # http://127.0.0.1:3847
npm test
npm run build
```

Data lives in `data/projects.json` (gitignored; reseeded when missing).

## Compose with other modules

| Module | Relationship |
| --- | --- |
| stage-gate | Posts stage advances; owns release decisions |
| smart-router | Future: route connector credentials |
| context-engine | Future: index snapshot text for agents |
| website | Showcase page links here |

## Docs

- `docs/problem-opportunity.md`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/market-gap.md`
- `docs/devils-advocate.md`

## License

Apache-2.0
