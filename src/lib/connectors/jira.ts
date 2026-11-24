import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { capContent } from "../content";
import { MAX_CONTENT_CHARS, type NewSnapshot } from "../types";
import { makeStubConnector } from "./factory";
import { resolveLocalTarget, type Connector, type ConnectorContext } from "./types";

const stubJiraConnector = makeStubConnector({
  source: "jira",
  stage: null,
  title: "Epic approval recorded (MIREVOX-101)",
  detail: "Requirements review ticket moved to Approved in Jira (stub; no network).",
  content:
    "Jira ticket MIREVOX-101 (Requirements Approval): Product and architecture reviewers confirmed functional and non-functional requirements completeness, traceability to discovery pain points, and acceptance exits prior to build stage progression.",
  metadata: {
    issueKey: "MIREVOX-101",
    issueType: "Approval",
    status: "Approved",
    decision: "approved",
    stageId: "requirements",
    criterionId: "req-review",
  },
  ref: "MIREVOX-101",
  minutesAgo: 120,
});

function strField(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = (val as Record<string, unknown>).displayName ?? (val as Record<string, unknown>).name;
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return undefined;
}

function extraStringMeta(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
    else if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean") {
      out[key] = String(v);
    }
  }
  return out;
}

function parseJsonJiraFile(
  raw: string,
  filePath: string,
  mtime: Date,
  ctx: ConnectorContext,
): NewSnapshot[] {
  const parsed = JSON.parse(raw) as unknown;
  let items: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    items = parsed.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object" && !Array.isArray(x)));
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.issues)) {
      items = obj.issues.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object" && !Array.isArray(x)));
    } else {
      items = [obj];
    }
  } else {
    throw new Error(`Invalid Jira JSON record in ${filePath}`);
  }

  const fileName = basename(filePath);
  return items.map((item, idx) => {
    const nestedMeta = extraStringMeta(item.metadata);
    const issueKey = strField(item, ["key", "issueKey", "id", "ref"]) ?? nestedMeta.issueKey ?? basename(fileName, extname(fileName));
    const summary = strField(item, ["summary", "title"]) ?? issueKey;
    const status = strField(item, ["status", "transition", "state"]) ?? nestedMeta.status ?? "recorded";
    const decision = strField(item, ["decision", "approval"]) ?? nestedMeta.decision;
    const stageId = strField(item, ["stageId", "stage"]) ?? nestedMeta.stageId;
    const criterionId = strField(item, ["criterionId", "substageId"]) ?? nestedMeta.criterionId;
    const issueType = strField(item, ["issueType", "type"]) ?? nestedMeta.issueType ?? "Issue";
    const approver = strField(item, ["approver", "reviewer", "assignee", "reporter"]) ?? nestedMeta.approver;
    const bodyText = strField(item, ["content", "description", "body", "comment"]) ?? "";

    const rawOccurred = strField(item, ["occurredAt", "updatedAt", "updated", "createdAt"]);
    const occurredAt =
      rawOccurred && !Number.isNaN(Date.parse(rawOccurred))
        ? new Date(rawOccurred).toISOString()
        : mtime.toISOString();

    const title = summary.startsWith(issueKey) ? summary : `${issueKey}: ${summary}`;
    const detail =
      strField(item, ["detail"]) ??
      `Local Jira ${issueType} ${issueKey} (${status})${stageId ? ` for stage ${stageId}` : ""}`;

    const content = capContent(
      [
        `${title} [${status}]`,
        stageId ? `Stage: ${stageId}` : "",
        approver ? `Actor: ${approver}` : "",
        bodyText ? `\n${bodyText}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    const digest = createHash("sha1")
      .update(`${ctx.appcode}|jira|${filePath}|${idx}|${issueKey}|${occurredAt}|${mtime.getTime()}`)
      .digest("hex")
      .slice(0, 12);

    return {
      id: `${ctx.appcode}:jira:local:${digest}`,
      appcode: ctx.appcode,
      source: "jira",
      stage: null,
      occurredAt,
      recordedAt: ctx.now.toISOString(),
      title,
      detail,
      ...(content ? { content } : {}),
      metadata: {
        ...nestedMeta,
        mode: "local",
        source: "jira",
        format: "json",
        fileName,
        filePath,
        issueKey,
        issueType,
        status,
        ...(decision ? { decision } : {}),
        ...(stageId ? { stageId } : {}),
        ...(criterionId ? { criterionId } : {}),
        ...(approver ? { approver } : {}),
      },
      ref: issueKey,
      provenance: "local",
      network: false,
    };
  });
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1].trim();
    const val = kv[2].trim().replace(/^(['"])(.*)\1$/, "$2").trim();
    if (key && val) frontmatter[key] = val;
  }
  return { frontmatter, body: raw.slice(match[0].length) };
}

function parseMarkdownJiraFile(
  raw: string,
  filePath: string,
  mtime: Date,
  ctx: ConnectorContext,
): NewSnapshot {
  const fileName = basename(filePath);
  const { frontmatter, body } = parseFrontmatter(raw);
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();

  const issueKey =
    frontmatter.key ??
    frontmatter.issueKey ??
    frontmatter.ref ??
    (/^([A-Z][A-Z0-9]+-\d+)/i.exec(fileName)?.[1]?.toUpperCase() || basename(fileName, extname(fileName)));
  const summary = frontmatter.summary ?? frontmatter.title ?? heading ?? issueKey;
  const status = frontmatter.status ?? frontmatter.decision ?? "recorded";
  const decision = frontmatter.decision ?? frontmatter.status;
  const stageId = frontmatter.stageId ?? frontmatter.stage;
  const criterionId = frontmatter.criterionId;
  const issueType = frontmatter.issueType ?? frontmatter.type ?? "Issue";
  const approver = frontmatter.approver ?? frontmatter.reviewer ?? frontmatter.assignee;

  const rawOccurred = frontmatter.occurredAt ?? frontmatter.updatedAt;
  const occurredAt =
    rawOccurred && !Number.isNaN(Date.parse(rawOccurred))
      ? new Date(rawOccurred).toISOString()
      : mtime.toISOString();

  const title = summary.startsWith(issueKey) ? summary : `${issueKey}: ${summary}`;
  const content = capContent(body.trim() || raw);
  const digest = createHash("sha1")
    .update(`${ctx.appcode}|jira|${filePath}|${mtime.getTime()}`)
    .digest("hex")
    .slice(0, 12);

  return {
    id: `${ctx.appcode}:jira:local:${digest}`,
    appcode: ctx.appcode,
    source: "jira",
    stage: null,
    occurredAt,
    recordedAt: ctx.now.toISOString(),
    title,
    detail: `Local Jira ${issueType} ${issueKey} (${status})${stageId ? ` for stage ${stageId}` : ""}`,
    ...(content ? { content } : {}),
    metadata: {
      ...frontmatter,
      mode: "local",
      source: "jira",
      format: "markdown",
      fileName,
      filePath,
      bytes: String(Buffer.byteLength(raw, "utf8")),
      truncated: String((body.trim() || raw).length > MAX_CONTENT_CHARS),
      issueKey,
      issueType,
      status,
      ...(decision ? { decision } : {}),
      ...(stageId ? { stageId } : {}),
      ...(criterionId ? { criterionId } : {}),
      ...(approver ? { approver } : {}),
    },
    ref: issueKey,
    provenance: "local",
    network: false,
  };
}

function readLocalJiraSnapshots(ctx: ConnectorContext): NewSnapshot[] {
  const fsPath = resolveLocalTarget(ctx.binding.target, /^(jira|local):\/\//);
  if (!existsSync(fsPath)) {
    throw new Error(`Local jira path not found: ${fsPath}`);
  }
  const st = statSync(fsPath);
  const files = st.isDirectory()
    ? readdirSync(fsPath)
        .filter((f) => /\.(json|md)$/i.test(f))
        .sort()
        .slice(0, 20)
        .map((f) => join(fsPath, f))
    : [fsPath];

  const snapshots: NewSnapshot[] = [];
  for (const filePath of files) {
    const raw = readFileSync(filePath, "utf8");
    const fstat = statSync(filePath);
    if (extname(filePath).toLowerCase() === ".json") {
      snapshots.push(...parseJsonJiraFile(raw, filePath, fstat.mtime, ctx));
    } else {
      snapshots.push(parseMarkdownJiraFile(raw, filePath, fstat.mtime, ctx));
    }
  }
  return snapshots;
}

/**
 * Jira connector supporting stub fixtures and local `.json`/`.md` records.
 * Emits `stage: null` with `metadata.stageId` since Jira tracks cross-stage approvals
 * rather than owning a single `DEFAULT_OWNERSHIP` slot.
 */
export const jiraConnector: Connector = {
  source: "jira",
  stub: true,
  async fetchSnapshots(ctx) {
    if (ctx.binding.mode !== "local") {
      return stubJiraConnector.fetchSnapshots(ctx);
    }
    return readLocalJiraSnapshots(ctx);
  },
};
