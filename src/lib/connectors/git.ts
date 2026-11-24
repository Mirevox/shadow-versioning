import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { capContent } from "../content";
import { makeStubConnector } from "./factory";
import { resolveLocalTarget, type Connector } from "./types";

const stubGitConnector = makeStubConnector({
  source: "git",
  stage: "build",
  title: "Build snapshot: default branch advanced",
  detail: "Implementation work was recorded on the service repository (stub; no network).",
  content:
    "Git repository build snapshot: implemented domain types, connector normalization adapters, atomic ledger persistence with unique temp filenames, composite version bundle builder, and loop-guarded context bridge integration without modifying upstream authoring tools.",
  metadata: {
    branch: "main",
    commitSha: "git-stub-ref-3f9c2ab",
  },
  ref: "git-stub-ref-3f9c2ab",
  minutesAgo: 90,
});

export const gitConnector: Connector = {
  source: "git",
  stub: true,
  async fetchSnapshots(ctx) {
    if (ctx.binding.mode !== "local") {
      return stubGitConnector.fetchSnapshots(ctx);
    }
    const repoPath = resolveLocalTarget(ctx.binding.target, /^(git|local):\/\//, true);
    if (!existsSync(repoPath)) {
      throw new Error(`Local git path not found: ${repoPath}`);
    }
    const raw = execFileSync(
      "git",
      ["-C", repoPath, "log", "-n", "5", "--stat", "--pretty=format:%x1e%H%x1f%cI%x1f%an%x1f%s%x1f%b%x1f"],
      { encoding: "utf8" },
    );
    const records = raw
      .split("\x1e")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return records.map((entry) => {
      const [sha = "", isoDate = "", author = "", rawSubject = "", body = "", statText = ""] =
        entry.split("\x1f");
      const subject = rawSubject.trim() || "Commit recorded";
      const ref = sha.slice(0, 12);
      const digest = createHash("sha1").update(`${ctx.appcode}|git|${sha}`).digest("hex").slice(0, 12);
      const occurredAt = Number.isNaN(Date.parse(isoDate))
        ? ctx.now.toISOString()
        : new Date(isoDate).toISOString();
      const content = capContent(
        [
          `Commit: ${sha}`,
          author.trim() ? `Author: ${author.trim()}` : "",
          `Date: ${occurredAt}`,
          `Subject: ${subject}`,
          body.trim() ? `\n${body.trim()}` : "",
          statText.trim() ? `\nChanged files:\n${statText.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return {
        id: `${ctx.appcode}:git:local:${digest}`,
        appcode: ctx.appcode,
        source: "git",
        stage: "build",
        occurredAt,
        recordedAt: ctx.now.toISOString(),
        title: subject,
        detail: `Local git commit ${ref} from ${repoPath}`,
        ...(content ? { content } : {}),
        metadata: {
          mode: "local",
          source: "git",
          commitSha: sha,
          shortSha: ref,
          ...(author.trim() ? { author: author.trim() } : {}),
          repoPath,
          stageId: "build",
        },
        ref,
        provenance: "local",
        network: false,
      };
    });
  },
};
