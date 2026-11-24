import { createServer, type IncomingMessage } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as healthGet } from "../src/app/api/health/route";
import { POST as stageEventsPost } from "../src/app/api/projects/[appcode]/stage-events/route";
import { POST as syncPost } from "../src/app/api/projects/[appcode]/sync/route";
import { POST as timelinePost } from "../src/app/api/projects/[appcode]/timeline/route";
import { GET as versionsGet } from "../src/app/api/projects/[appcode]/versions/route";
import {
  CONNECTORS,
  EXTRA_CONNECTORS,
  STUB_LABEL,
  confluenceConnector,
  getConnector,
  gitConnector,
  jiraConnector,
  sharepointConnector,
  testingConnector,
} from "../src/lib/connectors";
import { pushSnapshotsToContextEngine } from "../src/lib/context-bridge";
import { SEED_APPCODE, buildSeedStore } from "../src/lib/seed";
import { StoreError, appendSnapshots, createProject, getProject } from "../src/lib/store";
import { recordStageSnapshot, runStubSync } from "../src/lib/sync-model";
import { MAX_CONTENT_CHARS } from "../src/lib/types";
import { buildAppcodeVersionBundles } from "../src/lib/versions";

const APP = "appcode-v2-test-1";

async function readHttpBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function startMockHttpServer(
  handler: (req: IncomingMessage, body: string) => { status: number; json: unknown },
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const body = await readHttpBody(req);
        const result = handler(req, body);
        const text = JSON.stringify(result.json);
        res.writeHead(result.status, {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(text),
        });
        res.end(text);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

describe("shadow-versioning v0.2.0", () => {
  let dataDir = "";
  let prevDataDir: string | undefined;
  let prevContextUrl: string | undefined;
  let prevContextToken: string | undefined;
  let prevStageWebhook: string | undefined;
  const cleanups: Array<() => Promise<void> | void> = [];

  beforeEach(() => {
    prevDataDir = process.env.MIREVOX_DATA_DIR;
    prevContextUrl = process.env.CONTEXT_ENGINE_URL;
    prevContextToken = process.env.CONTEXT_ENGINE_TOKEN;
    prevStageWebhook = process.env.STAGE_GATE_WEBHOOK_URL;
    dataDir = mkdtempSync(path.join(tmpdir(), "mirevox-v2-"));
    process.env.MIREVOX_DATA_DIR = dataDir;
    delete process.env.CONTEXT_ENGINE_URL;
    delete process.env.CONTEXT_ENGINE_TOKEN;
    delete process.env.STAGE_GATE_WEBHOOK_URL;
  });

  afterEach(async () => {
    while (cleanups.length) {
      const fn = cleanups.pop()!;
      await fn();
    }
    if (prevDataDir === undefined) delete process.env.MIREVOX_DATA_DIR;
    else process.env.MIREVOX_DATA_DIR = prevDataDir;
    if (prevContextUrl === undefined) delete process.env.CONTEXT_ENGINE_URL;
    else process.env.CONTEXT_ENGINE_URL = prevContextUrl;
    if (prevContextToken === undefined) delete process.env.CONTEXT_ENGINE_TOKEN;
    else process.env.CONTEXT_ENGINE_TOKEN = prevContextToken;
    if (prevStageWebhook === undefined) delete process.env.STAGE_GATE_WEBHOOK_URL;
    else process.env.STAGE_GATE_WEBHOOK_URL = prevStageWebhook;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps CONNECTORS v0.1-compatible while exposing jiraConnector via EXTRA_CONNECTORS and getConnector", async () => {
    expect(Object.keys(CONNECTORS).sort()).toEqual(["confluence", "git", "sharepoint", "testing"]);
    expect(EXTRA_CONNECTORS.jira).toBe(jiraConnector);
    expect(getConnector("jira")).toBe(jiraConnector);
    expect(getConnector("stage-gate")).toBeUndefined();

    const now = new Date("2026-11-24T00:00:00.000Z");
    const stubEvents = await jiraConnector.fetchSnapshots({
      appcode: APP,
      binding: { source: "jira", target: "jira://PROJ/board", mode: "stub", enabled: true },
      now,
    });
    expect(stubEvents).toHaveLength(1);
    expect(stubEvents[0]).toMatchObject({
      appcode: APP,
      source: "jira",
      stage: null,
      provenance: "stub",
      network: false,
    });
    expect(stubEvents[0].title).toContain(STUB_LABEL);
    expect(stubEvents[0].content?.length).toBeGreaterThan(40);
    expect(stubEvents[0].metadata?.stageId).toBe("requirements");

    const seedManifest = buildSeedStore().projects[SEED_APPCODE].manifest;
    expect(seedManifest.bindings.some((b) => b.source === "jira")).toBe(true);
    const seedSync = await runStubSync(seedManifest, now);
    expect(seedSync).toHaveLength(5);
    expect(seedSync.some((e) => e.source === "jira" && e.stage === null)).toBe(true);
  });

  it("parses local .json and .md Jira records with stage: null and metadata.stageId", async () => {
    const jiraDir = mkdtempSync(path.join(tmpdir(), "mirevox-jira-local-"));
    cleanups.push(() => rmSync(jiraDir, { recursive: true, force: true }));

    writeFileSync(
      path.join(jiraDir, "01-approvals.json"),
      JSON.stringify([
        {
          key: "PAY-42",
          summary: "Approve FR/NFR specifications",
          status: "Approved",
          decision: "approved",
          stageId: "requirements",
          criterionId: "req-review",
          approver: "Priya Patel",
          occurredAt: "2026-11-22T10:00:00.000Z",
          description:
            "Reviewed functional and non-functional requirements for the payment settlement workflow including latency budgets and PII redaction controls.",
        },
        {
          key: "PAY-43",
          summary: "Architecture spec sign-off",
          status: "In Review",
          stageId: "spec",
          content: "Pending security sign-off on webhook signature verification and replay protection.",
        },
      ]),
      "utf8",
    );

    writeFileSync(
      path.join(jiraDir, "02-epic.md"),
      [
        "---",
        "key: PAY-50",
        "title: Settlement Retry Epic",
        "status: Approved",
        "decision: approved",
        "stageId: build",
        "approver: Alex Rivera",
        "occurredAt: 2026-11-23T08:15:00.000Z",
        "---",
        "# Settlement Retry Epic",
        "",
        "Implement idempotent retry queues with dead-letter inspection and operator replay audit logs.",
      ].join("\n"),
      "utf8",
    );

    const now = new Date("2026-11-24T01:00:00.000Z");
    const events = await jiraConnector.fetchSnapshots({
      appcode: APP,
      binding: { source: "jira", target: jiraDir, mode: "local", enabled: true },
      now,
    });

    expect(events).toHaveLength(3);
    expect(events.every((e) => e.source === "jira" && e.stage === null)).toBe(true);
    expect(events.every((e) => e.provenance === "local" && e.network === false)).toBe(true);

    expect(events[0].ref).toBe("PAY-42");
    expect(events[0].metadata).toMatchObject({
      mode: "local",
      format: "json",
      issueKey: "PAY-42",
      status: "Approved",
      decision: "approved",
      stageId: "requirements",
      criterionId: "req-review",
      approver: "Priya Patel",
    });
    expect(events[0].content).toContain("payment settlement workflow");

    expect(events[1].ref).toBe("PAY-43");
    expect(events[1].metadata?.stageId).toBe("spec");

    expect(events[2].ref).toBe("PAY-50");
    expect(events[2].metadata).toMatchObject({
      mode: "local",
      format: "markdown",
      issueKey: "PAY-50",
      status: "Approved",
      decision: "approved",
      stageId: "build",
      approver: "Alex Rivera",
    });
    expect(events[2].content).toContain("idempotent retry queues");
  });

  it("preserves substantive content (<= 32768 chars) and structured metadata across all connectors", async () => {
    const now = new Date("2026-11-24T02:00:00.000Z");

    for (const connector of [
      confluenceConnector,
      sharepointConnector,
      gitConnector,
      testingConnector,
      jiraConnector,
    ]) {
      const stub = await connector.fetchSnapshots({
        appcode: APP,
        binding: { source: connector.source, target: `${connector.source}://demo`, mode: "stub", enabled: true },
        now,
      });
      expect(stub[0].content).toBeTruthy();
      expect(stub[0].content!.length).toBeGreaterThan(40);
      expect(stub[0].content!.length).toBeLessThanOrEqual(MAX_CONTENT_CHARS);
      expect(stub[0].metadata).toMatchObject({ mode: "stub", source: connector.source });
    }

    const workDir = mkdtempSync(path.join(tmpdir(), "mirevox-local-conn-"));
    cleanups.push(() => rmSync(workDir, { recursive: true, force: true }));

    const hugeMd = `# Oversized Spec\n${"requirement-detail ".repeat(3000)}`;
    writeFileSync(path.join(workDir, "huge.md"), hugeMd, "utf8");

    const spEvents = await sharepointConnector.fetchSnapshots({
      appcode: APP,
      binding: { source: "sharepoint", target: path.join(workDir, "huge.md"), mode: "local", enabled: true },
      now,
    });
    expect(spEvents).toHaveLength(1);
    expect(spEvents[0].content?.length).toBe(MAX_CONTENT_CHARS);
    expect(spEvents[0].metadata).toMatchObject({
      mode: "local",
      source: "sharepoint",
      truncated: "true",
      stageId: "requirements",
    });

    const gitEvents = await gitConnector.fetchSnapshots({
      appcode: APP,
      binding: { source: "git", target: process.cwd(), mode: "local", enabled: true },
      now,
    });
    expect(gitEvents.length).toBeGreaterThan(0);
    expect(gitEvents[0].content).toContain("Commit:");
    expect(gitEvents[0].metadata).toMatchObject({
      mode: "local",
      source: "git",
      stageId: "build",
    });
    expect(gitEvents[0].metadata?.commitSha).toBeTruthy();

    writeFileSync(
      path.join(workDir, "report.json"),
      JSON.stringify({
        suite: "checkout-e2e",
        runId: "run-901",
        status: "passed",
        summary: { passed: 42, failed: 0, skipped: 1, total: 43 },
        notes: "All checkout happy-path and retry tests succeeded.",
      }),
      "utf8",
    );
    writeFileSync(
      path.join(workDir, "junit.xml"),
      `<testsuite name="unit-core" tests="12" failures="1" errors="0" skipped="2"></testsuite>`,
      "utf8",
    );

    const testJsonEvents = await testingConnector.fetchSnapshots({
      appcode: APP,
      binding: { source: "testing", target: path.join(workDir, "report.json"), mode: "local", enabled: true },
      now,
    });
    expect(testJsonEvents).toHaveLength(1);
    expect(testJsonEvents[0]).toMatchObject({
      source: "testing",
      stage: "test",
      provenance: "local",
      network: false,
      ref: "run-901",
    });
    expect(testJsonEvents[0].metadata).toMatchObject({
      mode: "local",
      format: "json",
      suite: "checkout-e2e",
      passed: "42",
      failed: "0",
      skipped: "1",
      total: "43",
      status: "passed",
    });
    expect(testJsonEvents[0].content).toContain("checkout-e2e");

    const testXmlEvents = await testingConnector.fetchSnapshots({
      appcode: APP,
      binding: { source: "testing", target: path.join(workDir, "junit.xml"), mode: "local", enabled: true },
      now,
    });
    expect(testXmlEvents).toHaveLength(1);
    expect(testXmlEvents[0].metadata).toMatchObject({
      mode: "local",
      format: "junit-xml",
      suite: "unit-core",
      passed: "9",
      failed: "1",
      skipped: "2",
      total: "12",
      status: "failed",
    });
  });

  it("builds immutable composite appcode@vN bundles chronologically and serves GET /versions", async () => {
    const project = createProject({ appcode: APP, name: "Composite versions test" });
    appendSnapshots(
      APP,
      [
        {
          id: `${APP}:1`,
          appcode: APP,
          source: "confluence",
          stage: "pre-requirements",
          occurredAt: "2026-11-20T01:00:00.000Z",
          recordedAt: "2026-11-20T01:00:00.000Z",
          title: "Discovery v1",
          detail: "Initial problem statement",
          ref: "conf-1",
          provenance: "manual",
          network: false,
        },
        {
          id: `${APP}:2`,
          appcode: APP,
          source: "jira",
          stage: null,
          occurredAt: "2026-11-20T02:00:00.000Z",
          recordedAt: "2026-11-20T02:00:00.000Z",
          title: "JIRA-10 approved",
          detail: "Approved",
          metadata: { stageId: "requirements" },
          ref: "JIRA-10",
          provenance: "local",
          network: false,
        },
        {
          id: `${APP}:3`,
          appcode: APP,
          source: "confluence",
          stage: "pre-requirements",
          occurredAt: "2026-11-20T03:00:00.000Z",
          recordedAt: "2026-11-20T03:00:00.000Z",
          title: "Discovery v2",
          detail: "Updated scope",
          ref: "conf-2",
          provenance: "manual",
          network: false,
        },
      ],
    );

    const loaded = getProject(APP)!;
    // getProject returns newest-first snapshots; buildAppcodeVersionBundles must fold oldest-first.
    expect(loaded.snapshots[0].id).toBe(`${APP}:3`);
    const bundles = buildAppcodeVersionBundles(loaded);
    expect(bundles).toHaveLength(3);

    expect(bundles[0].version).toBe(`${APP}@v1`);
    expect(bundles[0].sources.confluence?.snapshotId).toBe(`${APP}:1`);
    expect(bundles[0].sources.jira).toBeUndefined();

    expect(bundles[1].version).toBe(`${APP}@v2`);
    expect(bundles[1].sources.confluence?.snapshotId).toBe(`${APP}:1`);
    expect(bundles[1].sources.jira?.snapshotId).toBe(`${APP}:2`);

    expect(bundles[2].version).toBe(`${APP}@v3`);
    expect(bundles[2].sources.confluence?.snapshotId).toBe(`${APP}:3`);
    expect(bundles[2].sources.jira?.snapshotId).toBe(`${APP}:2`);
    // Earlier bundle pin map remains immutable
    expect(bundles[0].sources.confluence?.snapshotId).toBe(`${APP}:1`);
    expect(new Set(bundles.map((b) => b.bundleHash)).size).toBe(3);
    expect(buildAppcodeVersionBundles(project)).toEqual([]);

    const ascRes = await versionsGet(new Request(`http://localhost/api/projects/${APP}/versions?order=asc`), {
      params: Promise.resolve({ appcode: APP }),
    });
    expect(ascRes.status).toBe(200);
    const ascBody = await ascRes.json();
    expect(ascBody.latestVersion).toBe(`${APP}@v3`);
    expect(ascBody.versions.map((v: { version: string }) => v.version)).toEqual([
      `${APP}@v1`,
      `${APP}@v2`,
      `${APP}@v3`,
    ]);

    const descRes = await versionsGet(new Request(`http://localhost/api/projects/${APP}/versions?order=desc`), {
      params: Promise.resolve({ appcode: APP }),
    });
    expect(descRes.status).toBe(200);
    const descBody = await descRes.json();
    expect(descBody.versions.map((v: { version: string }) => v.version)).toEqual([
      `${APP}@v3`,
      `${APP}@v2`,
      `${APP}@v1`,
    ]);
  });

  it("handles concurrent appendSnapshots safely, normalizes content/metadata, and skips zero-write replays", async () => {
    createProject({ appcode: APP, name: "Concurrency test" });

    const batches = Array.from({ length: 12 }, (_, idx) => [
      {
        id: `${APP}:batch:${idx}`,
        appcode: APP,
        source: "git" as const,
        stage: "build" as const,
        occurredAt: `2026-11-24T00:${String(idx).padStart(2, "0")}:00.000Z`,
        title: `Commit ${idx}`,
        detail: `Detail ${idx}`,
        content: idx === 0 ? "x".repeat(MAX_CONTENT_CHARS + 500) : `Body ${idx}`,
        metadata: { batch: String(idx), attempt: 1 as unknown as string },
        ref: `sha-${idx}`,
        provenance: "local" as const,
        network: false,
      },
      // Overlapping duplicate id across neighbors
      {
        id: `${APP}:shared:${idx % 3}`,
        appcode: APP,
        source: "testing" as const,
        stage: "test" as const,
        occurredAt: "2026-11-24T00:59:00.000Z",
        title: `Shared ${idx % 3}`,
        detail: "Shared batch",
        ref: `run-${idx % 3}`,
        provenance: "local" as const,
        network: false,
      },
    ]);

    await Promise.all(
      batches.map(async (batch, idx) => {
        await Promise.resolve();
        return appendSnapshots(APP, batch, new Date(Date.parse("2026-11-24T01:00:00.000Z") + idx * 1000));
      }),
    );

    const timeline = getProject(APP)!.snapshots;
    expect(timeline).toHaveLength(15);
    const seqs = timeline.map((s) => s.sequenceNumber).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));

    const capped = timeline.find((s) => s.id === `${APP}:batch:0`);
    expect(capped?.content?.length).toBe(MAX_CONTENT_CHARS);
    expect(capped?.metadata).toEqual({ batch: "0", attempt: "1" });

    const dirEntries = readdirSync(dataDir);
    expect(dirEntries.filter((f) => f.endsWith(".tmp"))).toEqual([]);

    const filePath = path.join(dataDir, "projects.json");
    const rawBefore = readFileSync(filePath, "utf8");
    expect(appendSnapshots(APP, batches[0])).toEqual([]);
    expect(readFileSync(filePath, "utf8")).toBe(rawBefore);

    expect(() =>
      appendSnapshots(APP, [
        {
          id: `${APP}:bad-meta`,
          appcode: APP,
          source: "git",
          stage: "build",
          occurredAt: "2026-11-24T02:00:00.000Z",
          title: "Bad metadata",
          detail: "",
          metadata: { nested: { a: 1 } } as unknown as Record<string, string>,
          ref: null,
          provenance: "manual",
          network: false,
        },
      ]),
    ).toThrow(StoreError);
  });

  it("bridges snapshots to context-engine mock server and degrades gracefully when unset, 404, or offline", async () => {
    const record = createProject({ appcode: APP, name: "Bridge test" });
    const [snap] = appendSnapshots(APP, [
      {
        id: `${APP}:bridge:1`,
        appcode: APP,
        source: "confluence",
        stage: "pre-requirements",
        occurredAt: "2026-11-24T00:00:00.000Z",
        title: "Bridge doc",
        detail: "Bridge detail",
        content: "Substantive discovery requirements for billing reconciler.",
        metadata: { stageId: "pre-requirements", space: "FIN" },
        ref: "FIN-1",
        provenance: "local",
        network: false,
      },
    ]);

    process.env.CONTEXT_ENGINE_URL = "";
    const skipped = await pushSnapshotsToContextEngine(record, [snap]);
    expect(skipped).toEqual({ attempted: false, ok: false, pushed: 0, skippedReason: "unconfigured" });

    const received: Array<{ url?: string; auth?: string; body: Record<string, unknown> }> = [];
    const okServer = await startMockHttpServer((req, body) => {
      received.push({
        url: req.url,
        auth: req.headers.authorization,
        body: JSON.parse(body) as Record<string, unknown>,
      });
      return { status: 200, json: { ok: true, ingested: 1 } };
    });
    cleanups.push(okServer.close);

    process.env.CONTEXT_ENGINE_URL = okServer.url;
    process.env.CONTEXT_ENGINE_TOKEN = "secret-tok";
    const okRes = await pushSnapshotsToContextEngine(record, [snap]);
    expect(okRes).toEqual({ attempted: true, ok: true, status: 200, pushed: 1 });
    expect(received).toHaveLength(1);
    expect(received[0].url).toBe(`/appcodes/${APP}/ingest`);
    expect(received[0].auth).toBe("Bearer secret-tok");
    const docs = received[0].body.documents as Array<Record<string, unknown>>;
    expect(docs[0]).toMatchObject({
      docId: snap.id,
      source: "confluence",
      stage: "pre-requirements",
      content: "Substantive discovery requirements for billing reconciler.",
    });

    const notFoundServer = await startMockHttpServer(() => ({ status: 404, json: { error: "not found" } }));
    cleanups.push(notFoundServer.close);
    process.env.CONTEXT_ENGINE_URL = notFoundServer.url;
    const res404 = await pushSnapshotsToContextEngine(record, [snap]);
    expect(res404).toMatchObject({ attempted: true, ok: false, status: 404, pushed: 0 });

    const offlineServer = await startMockHttpServer(() => ({ status: 200, json: {} }));
    const offlineUrl = offlineServer.url;
    await offlineServer.close();
    process.env.CONTEXT_ENGINE_URL = offlineUrl;
    const offlineRes = await pushSnapshotsToContextEngine(record, [snap]);
    expect(offlineRes.attempted).toBe(true);
    expect(offlineRes.ok).toBe(false);
    expect(offlineRes.pushed).toBe(0);
    expect(offlineRes.error).toBeTruthy();
  });

  it("enforces stage-events eventId dedupe, loop-guard callbacks, sync/timeline bridge pushes, and v0.2.0 health", async () => {
    const healthRes = await healthGet();
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toMatchObject({ status: "ok", ok: true, version: "0.2.0" });

    createProject({ appcode: APP, name: "Route bridge & loop guard" });

    const ceCalls: Array<{ url?: string; count: number }> = [];
    const ceServer = await startMockHttpServer((req, body) => {
      const parsed = JSON.parse(body) as { documents?: unknown[] };
      ceCalls.push({ url: req.url, count: parsed.documents?.length ?? 0 });
      return { status: 200, json: { ok: true } };
    });
    cleanups.push(ceServer.close);

    const sgCalls: Array<Record<string, unknown>> = [];
    const sgServer = await startMockHttpServer((_req, body) => {
      sgCalls.push(JSON.parse(body) as Record<string, unknown>);
      return { status: 200, json: { ok: true } };
    });
    cleanups.push(sgServer.close);

    process.env.CONTEXT_ENGINE_URL = ceServer.url;
    process.env.STAGE_GATE_WEBHOOK_URL = sgServer.url;

    // 1. POST /sync pushes 4 stub snapshots to context-engine
    const syncRes = await syncPost(new Request(`http://localhost/api/projects/${APP}/sync`, { method: "POST" }), {
      params: Promise.resolve({ appcode: APP }),
    });
    expect(syncRes.status).toBe(200);
    const syncJson = await syncRes.json();
    expect(syncJson.added).toBe(4);
    expect(syncJson.contextBridge).toMatchObject({ attempted: true, ok: true, pushed: 4 });
    expect(ceCalls).toHaveLength(1);
    expect(ceCalls[0]).toEqual({ url: `/appcodes/${APP}/ingest`, count: 4 });

    // 2. POST /timeline pushes manual snapshot to context-engine
    const tlRes = await timelinePost(
      new Request(`http://localhost/api/projects/${APP}/timeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "confluence",
          stage: "pre-requirements",
          title: "Stakeholder workshop notes",
          content: "Detailed notes from ops & compliance kickoff meeting.",
          metadata: { facilitator: "Morgan" },
        }),
      }),
      { params: Promise.resolve({ appcode: APP }) },
    );
    expect(tlRes.status).toBe(201);
    const tlJson = await tlRes.json();
    expect(tlJson.snapshot.content).toBe("Detailed notes from ops & compliance kickoff meeting.");
    expect(tlJson.contextBridge).toMatchObject({ attempted: true, ok: true, pushed: 1 });
    expect(ceCalls).toHaveLength(2);

    // 3. stage-events dedupes on eventId across separate calls without occurredAt
    const s1 = recordStageSnapshot(
      { appcode: APP, stage: "release", source: "stage-gate", title: "Gate", eventId: "evt-direct-1" },
      undefined,
      new Date("2026-11-24T00:00:00.000Z"),
    );
    const s2 = recordStageSnapshot(
      { appcode: APP, stage: "release", source: "stage-gate", title: "Gate", eventId: "evt-direct-1" },
      undefined,
      new Date("2026-11-24T00:05:00.000Z"),
    );
    expect(s1.id).toBe(s2.id);

    const se1 = await stageEventsPost(
      new Request(`http://localhost/api/projects/${APP}/stage-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "release",
          outcome: "cleared",
          eventId: "sg-evt-100",
          originSource: "stage-gate",
          skipStageGateCallback: true,
          hopCount: 1,
          content: "Stage-gate verified all required approvals before release promotion.",
        }),
      }),
      { params: Promise.resolve({ appcode: APP }) },
    );
    expect(se1.status).toBe(201);
    const se1Json = await se1.json();
    expect(se1Json.duplicate).toBe(false);
    expect(se1Json.snapshot.metadata).toMatchObject({
      originSource: "stage-gate",
      skipStageGateCallback: "true",
      hopCount: "1",
      eventId: "sg-evt-100",
    });
    expect(se1Json.stageGateCallback).toMatchObject({ attempted: false, skippedReason: "loop-guard" });
    expect(sgCalls).toHaveLength(0);

    // Retry same eventId -> duplicate: true, zero webhook, zero extra bridge push
    const se1Retry = await stageEventsPost(
      new Request(`http://localhost/api/projects/${APP}/stage-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "release",
          outcome: "cleared",
          eventId: "sg-evt-100",
          originSource: "stage-gate",
          skipStageGateCallback: true,
          hopCount: 1,
        }),
      }),
      { params: Promise.resolve({ appcode: APP }) },
    );
    expect(se1Retry.status).toBe(200);
    expect((await se1Retry.json()).duplicate).toBe(true);
    expect(ceCalls).toHaveLength(3);
    expect(sgCalls).toHaveLength(0);

    // hopCount > 3 also blocked by loop-guard even when originSource !== "stage-gate"
    const seHighHop = await stageEventsPost(
      new Request(`http://localhost/api/projects/${APP}/stage-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "build",
          outcome: "advanced",
          eventId: "cli-hop-4",
          originSource: "cli",
          skipStageGateCallback: false,
          hopCount: 4,
        }),
      }),
      { params: Promise.resolve({ appcode: APP }) },
    );
    expect(seHighHop.status).toBe(201);
    expect((await seHighHop.json()).stageGateCallback).toMatchObject({
      attempted: false,
      skippedReason: "loop-guard",
    });
    expect(sgCalls).toHaveLength(0);

    // Normal unguarded stage-event with hopCount <= 3 triggers webhook cleanly
    const seAllowed = await stageEventsPost(
      new Request(`http://localhost/api/projects/${APP}/stage-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "test",
          outcome: "passed",
          eventId: "cli-hop-1",
          originSource: "ci-runner",
          skipStageGateCallback: false,
          hopCount: 1,
        }),
      }),
      { params: Promise.resolve({ appcode: APP }) },
    );
    expect(seAllowed.status).toBe(201);
    const seAllowedJson = await seAllowed.json();
    expect(seAllowedJson.stageGateCallback).toMatchObject({ attempted: true, ok: true, status: 200 });
    expect(sgCalls).toHaveLength(1);
    expect(sgCalls[0]).toMatchObject({
      appcode: APP,
      stage: "test",
      originSource: "shadow-versioning",
      hopCount: 2,
      eventId: "cli-hop-1",
    });
  });
});
