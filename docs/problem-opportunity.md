---
cursor:
  subagentId: "bc-a5a4aa26-2f03-5474-a2ef-fb988adaa594"
  role: requirements-gatherer
---

# Mirevox Shadow Versioning — Problem & Opportunity

Brand: **Mirevox** · Target Repo: `https://github.com/Mirevox/shadow-versioning` · Paired Module: `stage-gate`

## 1. Executive Summary

Software delivery in real organizations splits across two incompatible worlds. Engineers live in Git (GitHub/Bitbucket), where every change has a commit hash, a diff, and a history. Product managers, business analysts, architects, QA leads, and compliance reviewers live in Confluence, SharePoint, and testing platforms, where versioning is fragmented, opaque, and disconnected from code.

Trying to drag non-technical people into Git fails every time — they will not learn Git verbs (`branch`, `rebase`, `merge`, `cherry-pick`, `pull request`). Conversely, letting requirements, approvals, code, and test results drift across four disconnected tools leaves teams unable to answer basic questions: *Which version of the requirements did this build implement? Did someone edit the Confluence page after sign-off? What evidence supports passing this stage gate?*

**Mirevox Shadow Versioning** solves this without changing how humans work. Using a shared project identifier (`appcode-xyz-0`), it binds Confluence, SharePoint, GitHub/Bitbucket, and testing platforms into a single versioned timeline. Under the hood, an immutable shadow version store records snapshots, diffs, and stage baselines; on top, non-technical users get a plain-language central document and version view integrated directly with the Mirevox `stage-gate` workflow. Rather than attempting fragile bidirectional sync, shadow versioning enforces a **stage-owned sync model** where one system owns truth at each lifecycle stage and all other systems receive clean references or read-only projections.

## 2. The Problem

### 2.1 Non-Technical Users Will Not Learn Git
"Docs-as-code" initiatives repeatedly stall at the engineering boundary. Non-technical stakeholders already have high-velocity workflows in Confluence (rich-text wikis, inline comments), SharePoint/Office (Word/PDF sign-off packs, spreadsheets, governance folders), and dedicated test-management tools. Asking them to open a terminal, resolve Markdown merge conflicts, or understand detached `HEAD` states causes them to abandon the system and fall back to emailed attachments (`Requirements_v3_FINAL_reviewed2.docx`).

### 2.2 Fragmented Truth Across Four Tool Silos
A single project routinely spans:
- **Confluence** for discovery notes, High-Level Requirements (HLRs), Functional/Non-Functional Requirements (FR/NFRs), and Architecture Decision Records (ADRs).
- **SharePoint** for executive charters, vendor/security sign-offs, regulatory evidence, and Office documents.
- **GitHub / Bitbucket** for source code, infrastructure definitions, technical specs, and pull requests.
- **Testing platforms** (e.g., Xray, Zephyr, TestRail, Azure Test Plans, CI test reports) for test cases, execution runs, and defect links.

Because these platforms have no shared cross-system version ledger, teams suffer from:
- **Silent drift:** A PM tweaks an acceptance criterion in Confluence during sprint execution; engineers and AI agents keep building against last week's version.
- **Broken audit trails:** Passing a release gate requires manually screenshotting pages, zipping SharePoint files, and pasting commit SHAs into a ticket.
- **Agent blind spots:** AI coding harnesses (VS Code + side agents, Claude/Cursor/Codex workflows) only see the Git repo by default. When a non-technical user drives a workflow on top of a harness, the agent either misses off-repo documents or ingests stale copies.

### 2.3 Why Naive Two-Way Sync Fails
Many integration tools promise "real-time two-way sync" between Confluence/SharePoint and Git. In practice, bidirectional sync breaks down quickly:
- Rich text, macros, tables, comments, and `.docx` formatting do not round-trip cleanly through Markdown.
- Concurrent edits in two systems create merge conflicts that non-technical users cannot resolve.
- Nobody knows which copy is legally or operationally authoritative when copies diverge.

### 2.4 Gaps in Existing Workflow & Harness Tooling
Modern AI agent harnesses focus on code sandboxes, tool calls, and retries inside a Git workspace. Enterprise ALM suites (Jira Align, Polarion, Azure DevOps) try to force every team into one monolithic vendor ecosystem. Neither provides a lightweight, open-source, harness-agnostic layer that binds existing tools together around a visual stage-gate workflow.

## 3. The Opportunity

Mirevox does not compete on foundation models or try to replace Confluence, SharePoint, or Git. Instead, `shadow-versioning` provides the missing connective tissue between human authoring tools, AI-assisted delivery workflows, and versioned truth:

1. **Git-grade versioning as invisible infrastructure ("shadow versioning"):** Every relevant document revision, code milestone, and test run is captured in an immutable, content-addressed version store behind the scenes. Humans interact with plain-language history ("Saved by Priya in Confluence", "Locked at Requirements Gate", "Compare Discovery vs. Build Baseline") — never Git jargon.
2. **One binding key across all tools (`appcode-xyz-0`):** A simple, deterministic project identifier links spaces, folders, repositories, branches, and test suites across platforms without requiring organizations to migrate data out of their existing systems.
3. **Stage-owned truth instead of sync wars:** By pairing with Mirevox `stage-gate`, each delivery stage explicitly designates *which system owns truth* for each artifact class. Shadow versioning captures authoritative changes from the active owner, freezes immutable baselines at gate transitions, and detects out-of-stage edits as visible drift rather than silent overwrites.
4. **First-class pairing with `stage-gate` and the Mirevox control plane:** Non-technical users see version history directly inside their stage-gate UI, know whether artifacts are ready to advance a gate, and can feed exact approved baselines to downstream modules like `context-engine` (so AI agents index approved truth, not stale drafts) and `data-lineage` (for provenance/residency tracking).
5. **Open-source and modular from day one:** Any team can adopt `shadow-versioning` standalone or compose it with other Mirevox modules, starting on a single cloud VM with zero homelab infrastructure required.

## 4. Target Users & Jobs to Be Done

| Persona | Everyday Tools | Core Job to Be Done | Pain Without Shadow Versioning |
| :--- | :--- | :--- | :--- |
| **Non-Technical Project Lead / PM / BA** | Confluence, SharePoint, Mirevox Stage UI | Author requirements in familiar tools, see clean revision history, and know when a stage is ready to advance — without touching Git. | Forced to copy-paste docs into repos, loses track of which version engineering actually built. |
| **Engineer / AI Harness Operator** | VS Code, GitHub/Bitbucket, AI Agents | Consume unambiguous, version-pinned requirements and specs; push code/ADRs that stay traceable to business intent. | Builds against stale Confluence pages; wastes time reconciling chat threads and doc edits. |
| **QA / Test & Compliance Reviewer** | Testing platform, SharePoint, Central Timeline UI | Verify which requirement baseline was tested, inspect exact diffs since the last approved gate, and export an audit trail. | Manual evidence collection across 4 tools before every release gate. |
| **Mirevox Integrator / Control-Plane Builder** | REST APIs, Webhooks, Docker, `stage-gate`, `context-engine` | Plug versioned project snapshots into stage gates, agent context indexing, and evals via clean open-source interfaces. | Custom brittle glue scripts per repository and SaaS platform. |

## 5. The Stage-Owned Sync Model (Overview)

To eliminate bidirectional merge conflicts, `shadow-versioning` operates on a **Single-Writer-Per-Stage (Stage-Owned Truth)** model:

- **One authoritative writer per artifact class per stage:** During *Pre-Requirements* and *Requirements*, Confluence (and SharePoint for governance/charter files) owns requirements truth. During *Build*, GitHub/Bitbucket owns implementation truth (code, technical specs/ADRs as configured). During *Verification*, the testing platform owns execution and pass/fail evidence.
- **Shadow capture, not human migration:** Shadow versioning observes the active owner (via webhook, poll, or manual sync) and writes normalized, immutable snapshots to its internal version store under the project's `appcode-xyz-0` timeline.
- **Gate freezes and ownership handoffs:** When `stage-gate` advances a project from Stage N to Stage N+1, shadow versioning seals an immutable **Stage Baseline** (e.g., `appcode-xyz-0@gate-requirements-v1`). Ownership of downstream work shifts to the next stage's designated system.
- **Read-only projections:** Non-owning systems may receive lightweight, non-authoritative summaries, status badges, or deep-links pointing back to the central timeline — never conflicting editable duplicates.
- **Explicit drift detection:** If someone edits a Confluence requirements page *after* the project has moved into *Build*, shadow versioning does **not** silently overwrite the Build baseline or fail with a Git merge conflict. Instead, it flags a **Drift Event** in the central timeline and stage UI so a human can choose to either *accept as an amendment (creating a new versioned baseline)* or *dismiss as informational*.
- **Workflow flexibility:** Because Mirevox `stage-gate` is not locked to strict spec-driven development (SpecKit/OpenSpec/custom agent workflows are all options), stage-to-owner mappings are configurable per project template while shipping with a sensible default.

*(Detailed stage-by-stage ownership table and handoff rules are specified in `requirements-draft.md`.)*

## 6. v1 Scope & Explicit Non-Goals

### 6.1 Runnable v1 Scope (Cloud VM)
- Runs cleanly on a single cloud VM (lightweight local/Docker Compose runtime; no full homelab stack required).
- Project registry enforcing the `appcode-xyz-0` identifier pattern and cross-system resource bindings.
- Real shadow version store (immutable snapshots, content hashing, human-readable diffs, stage baselines) backed by an invisible local Git/object engine + relational metadata index.
- Central web UI showing project timelines, plain-language version history, diffs, stage baselines, and drift alerts — with zero Git jargon.
- Clean `stage-gate` integration API/webhooks (gate readiness, baseline freeze, stage-to-stage diff, embeddable version history view).
- Pluggable connector architecture shipping with realistic, deterministic **connector stubs** for Confluence, SharePoint, GitHub/Bitbucket, and Testing platforms (so the full lifecycle, stage handoffs, and drift detection can be demonstrated and tested end-to-end without external SaaS credentials).

### 6.2 Explicit Non-Goals (v1)
- **Not a Git replacement for developers:** Engineers continue using GitHub/Bitbucket normally.
- **Not a replacement document editor:** Shadow versioning does not build a Confluence or Word clone; it links back to native editors.
- **Not real-time collaborative bidirectional sync:** No two-way rich-text-to-Markdown merge engine.
- **Not a full enterprise compliance/GRC suite:** Aligns with Mirevox's decision not to bet the umbrella on a heavy cloud compliance product.
- **No unrelated integrations or heavy infra:** No n8n, no Instagram/social automation, no requirement to boot the full Sherali homelab stack.

## 7. Open Questions & Pressure Points for Downstream Council Roles

To help the Requirements Vetter, Architect, Market Researcher, and Devil's Advocate sharpen v1 before build:

1. **For Requirements Vetter:** How strict should gate blocking be when unresolved out-of-stage drift exists — hard block by default, soft warning with explicit acknowledgment, or configurable per gate?
2. **For Architect:** What is the cleanest v1 representation for binary SharePoint documents (`.docx`, `.pdf`, `.xlsx`) in the shadow store — metadata + hash + extracted plain text for readable diffs, while keeping raw binary references/blobs optional?
3. **For Architect:** Should the shadow store use native Git (`git` CLI / `isomorphic-git` / `dulwich`) under the hood so every project can be exported as a standard Git bundle, or a pure content-addressed DB with Git export on demand?
4. **For Market Researcher:** How do existing tools (GitBook, Notion-Git sync, Backstage TechDocs, Confluence-Git plugins, Jira/Xray traceability) fall short on *stage-owned truth* and *non-technical AI workflow integration*, and where is our sharpest open-source wedge?
5. **For Devil's Advocate:** Will non-technical users actually open *yet another UI* for version history, or must the primary value live inside `stage-gate` (embedded panel) plus deep-links/badges inside Confluence and SharePoint?
