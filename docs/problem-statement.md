# Problem statement

**Product:** Mirevox Shadow Versioning  
**Repo:** https://github.com/Mirevox/shadow-versioning  
**Pairs with:** Mirevox `stage-gate`

## The problem

Project truth is scattered. Requirements live in Confluence, sign-off packs in SharePoint, code in Git, and evidence in testing tools. Non-technical reviewers will not learn Git verbs to reconstruct what changed. Engineers and agents rebuild that story from tabs, chat, and memory.

Enterprise ALM suites solve this only if you migrate into them. Native history in Confluence or SharePoint stays siloed. Git UIs stay Git-shaped. Sync products write copies around and introduce conflict semantics. Teams that keep heterogeneous tools still cannot answer: *which requirement revision preceded this build, and what test evidence followed it?*

## What we solve

Shadow versioning is a **read-only projection** over histories that stay in their source systems. One stable project id (`appcode-…`) binds those sources. Stage-owned sync captures human-readable snapshots into a chronological ledger. Reviewers see plain-language timeline entries with deep links back to authoritative records—without treating Git as the human UI and without becoming a second system of record.

## What v1 does *not* claim

- Live Confluence / SharePoint / Git / test API ingestion (v1 ships deterministic **stubs** labelled stub/mock).
- Bidirectional write-back, ALM compliance certification, or a tamper-proof audit ledger.
- Replacing document management, Git clients, or Polarion/Jama-class platforms.

See `docs/v1-scope.md` for the intentional acceptance cut and `docs/market-gap.md` for competitive honesty.
