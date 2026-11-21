import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeStubConnector } from "./factory";
import type { Connector } from "./types";

const stubGitConnector = makeStubConnector({
  source: "git",
  stage: "build",
  title: "Build snapshot: default branch advanced",
  detail: "Implementation work was recorded on the service repository (stub; no network).",
  ref: "git-stub-ref-3f9c2ab",
  minutesAgo: 90,
});

function resolveLocalGitPath(target: string): string {
  if (target.startsWith("file://")) {
    return fileURLToPath(target);
  }
  const stripped = target.replace(/^(git|local):\/\//, "");
  return resolve(stripped === "." || !stripped ? process.cwd() : stripped);
}

export const gitConnector: Connector = {
  source: "git",
  stub: true,
  async fetchSnapshots(ctx) {
    if (ctx.binding.mode !== "local") {
      return stubGitConnector.fetchSnapshots(ctx);
    }
    const repoPath = resolveLocalGitPath(ctx.binding.target);
    if (!existsSync(repoPath)) {
      throw new Error(`Local git path not found: ${repoPath}`);
    }
    const raw = execFileSync(
      "git",
      ["-C", repoPath, "log", "-n", "5", "--pretty=format:%H|%cI|%s"],
      { encoding: "utf8" },
    );
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    return lines.map((line) => {
      const [sha, isoDate, ...subjectParts] = line.split("|");
      const subject = subjectParts.join("|").trim() || "Commit recorded";
      const ref = sha.slice(0, 12);
      const digest = createHash("sha1").update(`${ctx.appcode}|git|${sha}`).digest("hex").slice(0, 12);
      const occurredAt = Number.isNaN(Date.parse(isoDate))
        ? ctx.now.toISOString()
        : new Date(isoDate).toISOString();
      return {
        id: `${ctx.appcode}:git:local:${digest}`,
        appcode: ctx.appcode,
        source: "git",
        stage: "build",
        occurredAt,
        recordedAt: ctx.now.toISOString(),
        title: subject,
        detail: `Local git commit ${ref} from ${repoPath}`,
        ref,
        provenance: "local",
        network: false,
      };
    });
  },
};
