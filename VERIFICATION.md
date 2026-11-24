# Verification & Smoke Screen Report — `shadow-versioning` (`v0.2.0`)

| Field | Value |
| --- | --- |
| **Module** | `Mirevox/shadow-versioning` |
| **Package Version** | `0.2.0` |
| **Verification Status** | **VERIFIED** |
| **Verified At (UTC)** | `2026-11-24T01:55:22Z` |
| **Environment** | Node `v22.14.0`, Vitest `3.2.7`, Next.js `16.4.6`, Docker `linux/amd64` (`sherali` Docker Engine `29.8.1`) |

## Automated Typecheck, Lint, Build & Test Suite

- `tsc --noEmit`: **PASS** (exit `0`)
- `eslint . --max-warnings 0`: **PASS** (exit `0`)
- `vitest run`: **PASS (6/6 test files, 21/21 tests passed, 0 failed)**
  - Includes `tests/v2-jira-and-context-bridge.test.ts` (`7` tests): Jira stub + local `.json`/`.md` connectors, `content`/`metadata` preservation, composite `appcode@vN` bundles (`GET /api/projects/[appcode]/versions`), race-free atomic persistence, zero-write duplicate guard, loop-guard callbacks, and live/offline `context-bridge.ts` HTTP sync.
- `next build` (zero v0.2 env vars set): **PASS** (`4/4` static pages + dynamic `/api/projects/[appcode]/versions` & API routes).

## Offline Local Sync & Live Cross-Module Bridge Checks

- **v0.1 Dry-Run Regression (`appcode-audit-0`):** `syncedCount=8, appendedCount=8, localGitFound=true`.
- **v0.2 Cross-Source Sync, Composite Versioning & Bridge (`appcode-v2-enterprise-1`):**
  - Synced all `5` local sources (`confluence`, `sharepoint`, `jira`, `git`, `testing`), minting composite `appcode-v2-enterprise-1@v5` and pushing all `5` documents via `context-bridge.ts` into `context-engine` (`contextBridge.ok=true, pushed=5`).
  - Accepted downstream `stage-gate` transitions (`originSource=stage-gate`, loop-guarded), advancing composite bundle to `appcode-v2-enterprise-1@v7`.

## Container & Hygiene Verification

- Standalone Linux/x64 Docker image rebuilt cleanly: `mirevox/shadow-versioning:x64-verify d6f1d30b9b98 342MB`
- Workspace hygiene & security scan: `repos=9, all_docs_license_compose=True, hardcoded_paths=0, secret_hits=0, src_todo_hits=0`

## Reproduce Locally

```bash
npm run typecheck && npm test && npm run build
```
