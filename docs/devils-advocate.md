---
cursor:
  subagentId: "bc-a5a4aa26-2f03-5474-a2ef-fb988adaa594"
  role: devils-advocate
---

# Shadow versioning — devil’s advocate

Sources: `/cursor/stores/self/docs/product-synthesis.md` (module 4), `/cursor/stores/self/docs/mirevox-build-plan.md` (product 4), `/cursor/stores/self/internal/council-playbook.md` (runnable v1 now; Docker later; no live homelab). No market-gap doc was in scope. This cut does not need a competitor to lose to.

## Verdict

The synthesis describes a sync product. A runnable v1 is a project manifest plus an append-only log of human sentences, with four connectors that refuse to touch a network. Ship that. Anything that fetches, mirrors, writes back, or renders stage-gate is a different product and is cut.

“Shadow versioning” is a dangerous name. A shadow people trust is a second copy. v1 is a snapshot log that points at systems it does not read. The README says that in the first paragraph, or the name is a defect.

## Claims killed

Synthesis, module 4, quoted and replaced. Requirements may keep only the replacement sentence.

| Claim | Why it dies | Sentence allowed in requirements |
| --- | --- | --- |
| “Non-technical people won’t learn Git verbs.” | A motive. The blocker is knowing which moment is accepted, who is allowed to change the source, and whether the row is stale. A UI that hides `commit` and shows a SHA, a page id, or “snapshot-019” is still an engineer log. v1 does not teach the habit of when to record a moment. | The timeline’s primary text is a sentence a person can read aloud. Git words are absent from that sentence. |
| “Project id (`appcode-xyz-0`) binds Confluence, SharePoint, GitHub/Bitbucket, testing platforms.” | An id binds nothing. It is a key. “Bind” will be demoed as integration. `appcode-xyz-0` is a sample project name, not a version scheme. The `-0` suffix carries no revision, environment, or stage. GitHub and Bitbucket are one `git` kind; the host is an opaque locator. “Testing platforms” names no product, so v1 implements no vendor. | A project manifest stores an opaque appcode and four kinds of locator: `confluence`, `sharepoint`, `git`, `testing`. Locators are not fetched. |
| “Central document/version view without forcing everything into Git as the human UI.” | A document view stores documents. Stored bodies are a new residency path (lineage’s problem, created by this module), a cache that drifts, and a CMS. Avoiding Git as the UI is easy when you also avoid being version control. | The central view is a timeline of recorded moments: sentence, source name, time, unverified flag, optional stage citation. Bytes of the source stay in the source. |
| “Integrates with the workflow module (version history + stage UI).” | Stage-gate is a parallel build with no frozen API. A runtime import, a shared database, or a stage UI inside this repo will couple two unfinished modules and slip both. | A snapshot may store an opaque `stageId` and optional `gate` string. A fixture file shows a gate citing a snapshot id. This repo does not call stage-gate and does not draw stages. |
| Build plan: “appcode + Confluence/SharePoint/Git timeline.” | Acceptable only as a nickname for the slice below. As a delivery promise it reads as live connectors and a real timeline of those systems. | Same five-part slice as this note. The words “synced”, “live”, and “connected” do not appear in the UI or the README lead. |

Also killed, before anyone writes them into an architecture doc:

- Polling or webhooks. Polling belongs to the router’s discovery story. It is not a shadow-versioning feature. A stage transition that triggers a fetch is a poller with a costume.
- LLM summaries of diffs. A model-written “human” line is a hallucination with good grammar, plus a dependency on the router. Summary text is typed by a person or copied from a fixture.
- Client-supplied `recordedAt` as the sort key. Backdated rows forge a history. The server clock sorts. A source clock may be stored as an opaque string and is not the order.
- `PATCH` or per-snapshot delete. That rewrites the log. Correction is a new row. Whole-project delete may exist for local cleanup and destroys the log.
- OAuth, PATs, app registrations, and a key vault “so the stub can be flipped to real.” Credentials are how fake connectors are born. v1 has no secret inputs.
- Content diff, blame, branch, merge, conflict resolution. No second writer, so nothing to merge.
- Accounts, SSO, and multi-user permissions. One local process.
- Docker-compose as a gate. The playbook says home-lab Docker is later and not blocking. A process that restarts onto a local file is runnable.
- A shared npm/package library for “the Mirevox event bus.” The integration surface is a JSON shape a human can open.

## Must-keep slice

If these five exist and the kill criteria hold, v1 is done. Scope arguments stop there.

### 1. Appcode project manifest

One project record:

- `id` — caller-supplied, unique, URL-safe, 1–64 chars. Opaque. `appcode-xyz-0` is a legal example and stays stable while snapshots accumulate. Do not mint a new appcode to mean “next version.”
- `displayName` — words, e.g. “Claims portal.”
- `bindings[]` — zero or more, each:
  - `id`
  - `kind`: `confluence` \| `sharepoint` \| `git` \| `testing`
  - `displayName` — words, e.g. “Requirements page”
  - `locator` — opaque string, stored verbatim, never resolved
  - `citedByStage` — optional opaque string
  - `writeOwner` — the only legal value is `source`
  - `recordMode` — the only legal value is `append-only`
  - `implementation` — the only legal value is `stub`

The manifest survives process restart. JSON file or sqlite is the architect’s pick. The pick is not a research spike.

### 2. Human-readable snapshot timeline

Append-only rows. Create requires a non-empty `title` and a one-sentence `summary`. The list endpoint returns newest server-time first. Each row shows, in this order:

1. The summary sentence.
2. The binding’s display name and kind in words (“Confluence”, “SharePoint”, “Git”, “Testing”).
3. The flag that it is not live.
4. Server `recordedAt`.
5. If present: “Cited for stage `<stageId>`” plus the gate string when one was stored.

The locator, any SHA-like token, and any page id stay off the primary line. Empty summary is a 400, not a blank row. There is no body field, no HTML, no file, no diff.

Two origins, both unverified:

- `origin: fixture` — summary comes from the in-repo fixture for that kind.
- `origin: human` — summary comes from the request.

`verified` is false on every row in v1. `live` is false on every row in v1.

### 3. Connector stubs

Four stubs, one per `kind`. Each returns a fixture moment and sets `implementation: stub`, `network: false`, `verified: false`.

Fixture sentences, so the demo has something readable before a human types:

- Confluence: “Recorded a moment for the Confluence item named in the locator. Not fetched.”
- SharePoint: “Recorded a moment for the SharePoint item named in the locator. Not fetched.”
- Git: “Recorded a moment for the Git change named in the locator. Repository not cloned.”
- Testing: “Recorded a moment for the test item named in the locator. No run was queried.”

The stub does not fill in a realistic page title, a fake green test count, or a plausible SHA. Decorative realism is how a demo becomes a lie. A later real connector may replace a stub behind the same fields. v1 does not leave a dormant HTTP client in the tree for that day.

### 4. Stage-owned sync model (documented, and enforced by the enum)

v1 ships `docs/sync-model.md` in the product repo when that repo exists. Until then this section is the model. Code enforces it by allowing exactly one write owner.

Three roles, three different objects:

- **Source owns bytes.** Confluence, SharePoint, the Git host, or the test tool is the only writer of content for that binding. v1 never writes to them. It also never reads them.
- **Shadow owns the log.** The only write is appending a snapshot. The log does not update a previous sentence and does not push anywhere.
- **A stage owns the citation.** Stage-gate, later, decides whether a snapshot id is the evidence for a gate. This module stores the citation a client sends. It does not accept or reject the gate.

“Stage-owned sync” in v1 means: each binding may name the stage allowed to cite it (`citedByStage`), and no stage performs a sync. There is no job, no cursor, no etag, no webhook, no retry.

Designs that violate the model, to be rejected in review:

- Shadow saves a copy “so we have it if the source moves.” That is a second writer and a second store.
- Two bindings are both writable for the same artifact (the page and the Git mirror of the page). v1 has no writable bindings at all. Adding one is a new design.
- Entering a stage pulls that stage’s connectors. That is sync. It is cut.
- The newest timeline row is treated as the document of record. The row is a moment. The source is the document. The stage citation is the acceptance. Three different facts.

Conflict policy: two rows may disagree. The timeline shows both. v1 does not merge, rank, or declare a winner. Declaring a winner without a read of the source is fiction.

### 5. Conceptual stage-gate integration

Frozen shape, so the parallel stage-gate build does not invent a second one:

```json
{
  "appcode": "appcode-xyz-0",
  "stageId": "requirements",
  "gate": "accept",
  "snapshotId": "snap_01",
  "note": "Citation only. Shadow does not execute the gate."
}
```

v1 includes `fixtures/stage-gate-citation.json` with that shape and a snapshot id that the demo actually created. `stageId` is not checked against a stage catalog. An unknown stage id is stored. Looking it up would be a live dependency.

Module boundary: stage-gate may, later, GET a snapshot by id. Shadow does not embed the stepper, the substages, or the appointment-booking metaphor. Those are the other module.

Composition with the rest of Mirevox is one README paragraph: context-engine indexes repos; this module does not ingest them. Data-lineage traces where AI-bound bytes go; this module stores no source bytes, so it does not become an undeclared copy. The router is irrelevant here. No code imports across those repos in v1.

## Failure modes

### Drift

Someone records “Requirements draft saved,” then edits the Confluence page. The timeline still shows the sentence. A non-technical user will treat the top row as current, because timelines train that habit, and will advance a gate on a stale moment.

v1 cannot fix drift by syncing. It can only stop lying about it. Every row carries `verified: false` and “not live.” The UI copy does not say “latest,” “current,” or “up to date.” Sort order is “most recently recorded,” which is a fact about the log, not about the source. A row that cannot show unverified is a broken row. Shipping the timeline without that flag is worse than Git: Git at least fails loudly when you are behind.

### Dual-write

The attractive design is: the PM edits SharePoint, the repo mirrors the doc to Git, and shadow stores the “real” version for the stage UI. Three clocks, no owner, and the stage cites whichever write happened to be last. That is the product failing in production while the demo looks coherent.

The manifest’s single legal `writeOwner: source` plus `recordMode: append-only` is the entire defense. The moment a design doc adds `writeOwner: shadow` or `writeOwner: both`, stop the design. Do not “support it for power users.” Power users already have Git.

### Fake connectors

A stub that returns HTTP 200, a confident title, and a green test count will be screenshotted as “Confluence connected.” The audience for this umbrella includes people who cannot tell a fixture from a fetch. Decorative stubs are user deception, not scaffolding.

Defenses that have to be true in the tree, not in a comment:

- Response fields include `implementation: "stub"` and `network: false`.
- Fixture sentences say the item was not fetched or not cloned or not queried.
- No HTTP client, no SDK for Atlassian, Microsoft Graph, Git hosts, or a test vendor, no `fetch` in the connector path.
- No environment variable for a token, even unused.
- Tests fail if a connector opens a socket.

A feature flag “use real connector when creds exist” with an empty creds branch is still a fake connector. Delete the branch.

### Non-tech UX is still hard

A readable sentence does not make the product usable by the people named in the synthesis. Those people still have to:

- Invent or be handed an appcode and understand it is not a version.
- Know which Confluence page, SharePoint file, repo, or test item is the one that matters. The manifest does not discover this. Discovery was a router claim and does not transfer.
- Decide when a moment is worth recording. v1 offers no prompt tied to real work, because it is not inside those tools.
- Resist reading the top row as the truth. The unverified flag helps only if someone taught them what it means.

So the honest UX claim is narrow: a person who already knows which item they mean can leave a sentence, see it later in words, and see that it was not checked against the source. The claim “non-technical people get version control” is false and stays false after v1 ships. Do not put it on the site page.

If the primary line needs a glossary (locator, binding, snapshot, SHA, space key), the line is wrong and the build is not done. If the only way to demo it is to narrate over the JSON, the timeline endpoint is wrong.

## Kill criteria

Stop and cut. Do not “temporarily” violate these to make a richer demo.

1. A connector performs network I/O, imports an SDK for a real system, or returns a payload without `implementation: "stub"` and `network: false`.
2. Any snapshot persists source bytes: body, HTML, file, attachment, patch, or “just the diff.”
3. `writeOwner` accepts any value other than `source`, or any endpoint creates, updates, or deletes content in Confluence, SharePoint, Git, or a test tool.
4. A timeline primary line is a SHA, commit subject, page id, locator, or “snapshot-&lt;n&gt;” rather than the summary sentence. Or the UI says latest / current / synced / live / connected.
5. Runtime dependency on stage-gate, a Git host, Confluence, SharePoint, a test tool, the router, or an LLM. The citation fixture is the integration.
6. A second writer for one artifact, including shadow “also saving the doc,” a Git mirror binding that is writable, or a sync-on-stage-enter job.
7. `verified: true` anywhere in v1, or a fixture with a realistic title, pass-count, or SHA that reads as a fetched result.
8. Client clock controls order, or a snapshot can be patched or deleted individually.
9. The credential-free demo below does not pass. Response is to remove surface until it passes. Response is not to add a real connector, auth, or Docker to rescue it.

## Explicit cuts

Out of v1 even if a draft already contains them: live sync, webhooks, polling, OAuth, token storage, content mirror, diff viewer, branch metaphor, AI summary, user accounts, stage-gate UI, Bitbucket-versus-GitHub clients, TestRail/Xray/Zephyr/Azure parsers, JUnit ingestion, cross-module packages, homepage marketing that says non-engineers now have version control.

## Runnable proof

Zero credentials. One process. Restart between step 4 and step 5 so the log is real.

1. Create project `appcode-xyz-0` named “Claims portal.”
2. Add four bindings, one per kind, with human display names and dummy locators.
3. Record one fixture snapshot per binding and one human snapshot whose summary is a full sentence, with `stageId: requirements` and `gate: accept`.
4. GET the timeline. Five sentences, each marked not live, newest server-time first, locators off the primary line. The stage citation is visible on the human row.
5. Restart. GET again. Same five.
6. Connector tests assert no socket and reject a payload that omits the stub flags.
7. `docs/sync-model.md` matches this note’s write-owner rules. `fixtures/stage-gate-citation.json` cites a snapshot id from this demo.
8. A request that sets `writeOwner` to anything but `source`, omits `summary`, or includes a body field fails.

That demo is the acceptance test. A council review that cannot run it does not pass the slice.

## What is worth keeping

One join key other Mirevox modules can share later, and a log of moments that names the system a moment came from without impersonating that system. That is a small repo. It is worth shipping because stage-gate will otherwise invent an ad-hoc “version” string with no manifest behind it.

It is not worth a sync platform, a document store, or a friendlier Git. Those lose to the source systems’ own history the day a connector actually works, and they lie on every day before that.
