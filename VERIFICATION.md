# Verification & Smoke Screen Report — `shadow-versioning`

| Field | Value |
| --- | --- |
| **Module** | `Mirevox/shadow-versioning` |
| **Package Version** | `0.1.0` |
| **Verification Status** | **VERIFIED** |
| **Verified At (UTC)** | `2026-11-22T21:11:27Z` |
| **Environment** | Node `v22.14.0`, Vitest `3.2.7`, Docker `linux/amd64` (`sherali` Docker Engine `29.8.1`) |

## Automated Typecheck & Test Suite

- `tsc --noEmit`: **PASS** (exit `0`)
- `vitest run`: **PASS (5/5 test files, 14/14 tests passed, 0 failed)**

```text
[2m Test Files [22m [1m[32m5 passed[39m[22m[90m (5)[39m
[2m      Tests [22m [1m[32m14 passed[39m[22m[90m (14)[39m
```

## Offline Local Sync & Persistence Smoke Test

- Executed `syncAll` + `appendSnapshots` for `appcode-audit-0` across local Git history and offline Confluence/SharePoint connectors (`8` synced & persisted snapshots, real local Git commits discovered):
  `{"ok":true,"appcode":"appcode-audit-0","syncedCount":8,"appendedCount":8,"localGitFound":true}`

## Container & Hygiene Verification

- Standalone Linux/x64 Docker image built cleanly: `mirevox/shadow-versioning:x64-verify b6b3dce917ab 341MB`
- Workspace hygiene & security scan: `repos=9, all_docs_license_compose=True, hardcoded_paths=0, secret_hits=0, src_todo_hits=0`

## Reproduce Locally

```bash
npm run typecheck && npm test
```
