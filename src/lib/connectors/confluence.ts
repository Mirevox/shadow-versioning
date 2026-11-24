import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { capContent } from "../content";
import { MAX_CONTENT_CHARS, type NewSnapshot, type Stage } from "../types";
import { makeStubConnector } from "./factory";
import { resolveLocalTarget, type Connector, type ConnectorContext } from "./types";

const stubConfluenceConnector = makeStubConnector({
  source: "confluence",
  stage: "pre-requirements",
  title: "Discovery page revised",
  detail: "Problem statement and stakeholder notes were edited in the discovery space.",
  content:
    "Confluence discovery space update: documented target user personas, operational pain points from manual cross-system re-entry, baseline cycle-time metrics, high-level capabilities for unified intake tracking, and explicit out-of-scope boundaries for this delivery slice.",
  metadata: {
    space: "DISCOVERY",
    pageId: "confluence-page-stub-1042",
  },
  ref: "confluence-page-stub-1042",
  minutesAgo: 240,
});

export function readLocalMarkdownSnapshots(
  ctx: ConnectorContext,
  source: "confluence" | "sharepoint",
  stage: Stage,
): NewSnapshot[] {
  const fsPath = resolveLocalTarget(ctx.binding.target, /^(confluence|sharepoint|local):\/\//);
  if (!existsSync(fsPath)) {
    throw new Error(`Local ${source} path not found: ${fsPath}`);
  }
  const st = statSync(fsPath);
  const files = st.isDirectory()
    ? readdirSync(fsPath)
        .filter((f) => /\.(md|txt)$/i.test(f))
        .sort()
        .slice(0, 10)
        .map((f) => join(fsPath, f))
    : [fsPath];

  return files.map((filePath) => {
    const rawContent = readFileSync(filePath, "utf8");
    const fstat = statSync(filePath);
    const heading = /^#\s+(.+)$/m.exec(rawContent)?.[1]?.trim();
    const title = heading || basename(filePath);
    const content = capContent(rawContent);
    const digest = createHash("sha1")
      .update(`${ctx.appcode}|${source}|${filePath}|${fstat.mtimeMs}`)
      .digest("hex")
      .slice(0, 12);
    return {
      id: `${ctx.appcode}:${source}:local:${digest}`,
      appcode: ctx.appcode,
      source,
      stage,
      occurredAt: fstat.mtime.toISOString(),
      recordedAt: ctx.now.toISOString(),
      title,
      detail: `Local ${source} document ${basename(filePath)} (${rawContent.length} chars)`,
      ...(content ? { content } : {}),
      metadata: {
        mode: "local",
        source,
        fileName: basename(filePath),
        filePath,
        bytes: String(fstat.size),
        chars: String(rawContent.length),
        truncated: String(rawContent.length > MAX_CONTENT_CHARS),
        stageId: stage,
      },
      ref: basename(filePath),
      provenance: "local",
      network: false,
    };
  });
}

export const confluenceConnector: Connector = {
  source: "confluence",
  stub: true,
  async fetchSnapshots(ctx) {
    if (ctx.binding.mode !== "local") {
      return stubConfluenceConnector.fetchSnapshots(ctx);
    }
    return readLocalMarkdownSnapshots(ctx, "confluence", "pre-requirements");
  },
};
