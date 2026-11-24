import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { capContent } from "../content";
import { MAX_CONTENT_CHARS, type NewSnapshot } from "../types";
import { makeStubConnector } from "./factory";
import { resolveLocalTarget, type Connector, type ConnectorContext } from "./types";

const stubTestingConnector = makeStubConnector({
  source: "testing",
  stage: "test",
  title: "Regression suite finished",
  detail: "The nightly regression run completed with all mock checks passing.",
  content:
    "Nightly regression suite report: 212 of 212 automated checks passed (0 failed, 0 skipped) across unit validation, store persistence idempotency, connector fixture parsing, timeline ordering, and health readiness endpoints.",
  metadata: {
    suite: "nightly-regression",
    passed: "212",
    failed: "0",
    skipped: "0",
    total: "212",
    status: "passed",
  },
  ref: "test-run-stub-881",
  minutesAgo: 30,
});

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === "number" && Number.isFinite(val)) return val;
  }
  return undefined;
}

function parseLocalJsonReport(
  raw: string,
  filePath: string,
  mtime: Date,
): {
  title: string;
  detail: string;
  content: string;
  ref: string;
  occurredAt: string;
  extraMeta: Record<string, string>;
} {
  const fileName = basename(filePath);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const summaryObj =
    parsed.summary && typeof parsed.summary === "object" && !Array.isArray(parsed.summary)
      ? (parsed.summary as Record<string, unknown>)
      : parsed;

  const passed = pickNumber(summaryObj, ["passed", "numPassedTests", "ok"]);
  const failed = pickNumber(summaryObj, ["failed", "numFailedTests", "failures"]);
  const skipped = pickNumber(summaryObj, ["skipped", "numPendingTests", "pending"]);
  const total =
    pickNumber(summaryObj, ["total", "numTotalTests"]) ??
    (passed !== undefined || failed !== undefined || skipped !== undefined
      ? (passed ?? 0) + (failed ?? 0) + (skipped ?? 0)
      : undefined);

  const suite =
    typeof parsed.suite === "string" && parsed.suite.trim()
      ? parsed.suite.trim()
      : typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim()
        : undefined;
  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : suite
        ? `Test run: ${suite}`
        : `Test run: ${fileName}`;

  const status =
    typeof parsed.status === "string" && parsed.status.trim()
      ? parsed.status.trim()
      : typeof parsed.success === "boolean"
        ? parsed.success
          ? "passed"
          : "failed"
        : failed !== undefined
          ? failed === 0
            ? "passed"
            : "failed"
          : undefined;

  const rawOccurred = parsed.occurredAt ?? parsed.timestamp;
  const occurredAt =
    typeof rawOccurred === "string" && !Number.isNaN(Date.parse(rawOccurred))
      ? new Date(rawOccurred).toISOString()
      : mtime.toISOString();

  const ref =
    typeof parsed.runId === "string" && parsed.runId.trim()
      ? parsed.runId.trim()
      : typeof parsed.id === "string" && parsed.id.trim()
        ? parsed.id.trim()
        : fileName;

  const countParts = [
    passed !== undefined ? `${passed} passed` : "",
    failed !== undefined ? `${failed} failed` : "",
    skipped !== undefined ? `${skipped} skipped` : "",
    total !== undefined ? `${total} total` : "",
  ].filter(Boolean);

  const detail = countParts.length
    ? `Local test report ${fileName}: ${countParts.join(", ")}`
    : `Local test artifact ${fileName} (${raw.length} chars)`;

  const bodyText =
    typeof parsed.content === "string" && parsed.content.trim()
      ? parsed.content.trim()
      : typeof parsed.notes === "string" && parsed.notes.trim()
        ? parsed.notes.trim()
        : "";

  const content = capContent(
    [
      title,
      status ? `Status: ${status}` : "",
      countParts.length ? `Results: ${countParts.join(", ")}` : "",
      bodyText ? `\n${bodyText}` : "",
      `\nRaw report (${fileName}):\n${raw}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const extraMeta: Record<string, string> = {
    format: "json",
    ...(suite ? { suite } : {}),
    ...(status ? { status } : {}),
    ...(passed !== undefined ? { passed: String(passed) } : {}),
    ...(failed !== undefined ? { failed: String(failed) } : {}),
    ...(skipped !== undefined ? { skipped: String(skipped) } : {}),
    ...(total !== undefined ? { total: String(total) } : {}),
  };

  return { title, detail, content, ref, occurredAt, extraMeta };
}

function parseLocalXmlReport(raw: string, fileName: string, mtime: Date) {
  const suiteMatch = /<testsuite\b([^>]*)>/i.exec(raw);
  const attrs = suiteMatch?.[1] ?? "";
  const attr = (key: string): string | undefined =>
    new RegExp(`${key}=["']([^"']+)["']`, "i").exec(attrs)?.[1];
  const suite = attr("name");
  const tests = attr("tests");
  const failures = attr("failures");
  const errors = attr("errors");
  const skipped = attr("skipped");
  const totalNum = tests !== undefined ? Number(tests) : undefined;
  const failNum =
    failures !== undefined || errors !== undefined
      ? Number(failures ?? 0) + Number(errors ?? 0)
      : undefined;
  const skipNum = skipped !== undefined ? Number(skipped) : undefined;
  const passedNum =
    totalNum !== undefined && Number.isFinite(totalNum)
      ? Math.max(0, totalNum - (failNum ?? 0) - (skipNum ?? 0))
      : undefined;
  const status = failNum !== undefined ? (failNum === 0 ? "passed" : "failed") : undefined;

  return {
    title: suite ? `JUnit suite: ${suite}` : `JUnit report: ${fileName}`,
    detail:
      totalNum !== undefined
        ? `Local JUnit report ${fileName}: ${passedNum ?? 0} passed, ${failNum ?? 0} failed, ${skipNum ?? 0} skipped`
        : `Local JUnit report ${fileName} (${raw.length} chars)`,
    content: capContent(raw),
    ref: fileName,
    occurredAt: mtime.toISOString(),
    extraMeta: {
      format: "junit-xml",
      ...(suite ? { suite } : {}),
      ...(status ? { status } : {}),
      ...(passedNum !== undefined ? { passed: String(passedNum) } : {}),
      ...(failNum !== undefined ? { failed: String(failNum) } : {}),
      ...(skipNum !== undefined ? { skipped: String(skipNum) } : {}),
      ...(totalNum !== undefined ? { total: String(totalNum) } : {}),
    },
  };
}

function readLocalTestingSnapshots(ctx: ConnectorContext): NewSnapshot[] {
  const fsPath = resolveLocalTarget(ctx.binding.target, /^(testing|local):\/\//);
  if (!existsSync(fsPath)) {
    throw new Error(`Local testing path not found: ${fsPath}`);
  }
  const st = statSync(fsPath);
  const files = st.isDirectory()
    ? readdirSync(fsPath)
        .filter((f) => /\.(json|xml|md|txt)$/i.test(f))
        .sort()
        .slice(0, 20)
        .map((f) => join(fsPath, f))
    : [fsPath];

  return files.map((filePath) => {
    const raw = readFileSync(filePath, "utf8");
    const fstat = statSync(filePath);
    const fileName = basename(filePath);
    const ext = extname(filePath).toLowerCase();

    let parsed: {
      title: string;
      detail: string;
      content: string;
      ref: string;
      occurredAt: string;
      extraMeta: Record<string, string>;
    };

    if (ext === ".json") {
      try {
        parsed = parseLocalJsonReport(raw, filePath, fstat.mtime);
      } catch {
        parsed = {
          title: fileName,
          detail: `Local testing artifact ${fileName} (${raw.length} chars)`,
          content: capContent(raw),
          ref: fileName,
          occurredAt: fstat.mtime.toISOString(),
          extraMeta: { format: "json" },
        };
      }
    } else if (ext === ".xml") {
      parsed = parseLocalXmlReport(raw, fileName, fstat.mtime);
    } else {
      const heading = /^#\s+(.+)$/m.exec(raw)?.[1]?.trim();
      parsed = {
        title: heading || fileName,
        detail: `Local testing report ${fileName} (${raw.length} chars)`,
        content: capContent(raw),
        ref: fileName,
        occurredAt: fstat.mtime.toISOString(),
        extraMeta: { format: ext.replace(/^\./, "") || "text" },
      };
    }

    const digest = createHash("sha1")
      .update(`${ctx.appcode}|testing|${filePath}|${fstat.mtimeMs}`)
      .digest("hex")
      .slice(0, 12);

    return {
      id: `${ctx.appcode}:testing:local:${digest}`,
      appcode: ctx.appcode,
      source: "testing",
      stage: "test",
      occurredAt: parsed.occurredAt,
      recordedAt: ctx.now.toISOString(),
      title: parsed.title,
      detail: parsed.detail,
      ...(parsed.content ? { content: parsed.content } : {}),
      metadata: {
        mode: "local",
        source: "testing",
        fileName,
        filePath,
        bytes: String(fstat.size),
        chars: String(raw.length),
        truncated: String(raw.length > MAX_CONTENT_CHARS),
        stageId: "test",
        ...parsed.extraMeta,
      },
      ref: parsed.ref,
      provenance: "local",
      network: false,
    };
  });
}

export const testingConnector: Connector = {
  source: "testing",
  stub: true,
  async fetchSnapshots(ctx) {
    if (ctx.binding.mode !== "local") {
      return stubTestingConnector.fetchSnapshots(ctx);
    }
    return readLocalTestingSnapshots(ctx);
  },
};
