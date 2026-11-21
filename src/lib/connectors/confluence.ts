import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeStubConnector } from "./factory";
import type { Connector, ConnectorContext } from "./types";
import type { NewSnapshot, Stage } from "../types";

const stubConfluenceConnector = makeStubConnector({
  source: "confluence",
  stage: "pre-requirements",
  title: "Discovery page revised",
  detail: "Problem statement and stakeholder notes were edited in the discovery space.",
  ref: "confluence-page-stub-1042",
  minutesAgo: 240,
});

export function readLocalMarkdownSnapshots(
  ctx: ConnectorContext,
  source: "confluence" | "sharepoint",
  stage: Stage,
): NewSnapshot[] {
  const rawTarget = ctx.binding.target;
  const fsPath = rawTarget.startsWith("file://")
    ? fileURLToPath(rawTarget)
    : resolve(rawTarget.replace(/^(confluence|sharepoint|local):\/\//, ""));
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
    const content = readFileSync(filePath, "utf8");
    const fstat = statSync(filePath);
    const heading = /^#\s+(.+)$/m.exec(content)?.[1]?.trim();
    const title = heading || basename(filePath);
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
      detail: `Local ${source} document ${basename(filePath)} (${content.length} chars)`,
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
