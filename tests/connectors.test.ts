import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONNECTORS,
  confluenceConnector,
  gitConnector,
} from "../src/lib/connectors";
import { STUB_LABEL } from "../src/lib/connectors/types";

describe("connector stubs", () => {
  it("exposes confluence, sharepoint, git, testing as stubs", async () => {
    const kinds = Object.keys(CONNECTORS).sort();
    expect(kinds).toEqual(["confluence", "git", "sharepoint", "testing"]);

    for (const connector of Object.values(CONNECTORS)) {
      expect(connector.stub).toBe(true);
      const events = await connector.fetchSnapshots({
        appcode: "appcode-demo-0",
        binding: {
          source: connector.source,
          target: "stub://x",
          mode: "stub",
          enabled: true,
        },
        now: new Date("2026-11-20T00:00:00.000Z"),
      });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].provenance).toBe("stub");
      expect(events[0].network).toBe(false);
      expect(events[0].sequenceNumber).toBeUndefined();
      expect(events[0].title).toContain(STUB_LABEL);
      expect(events[0].source).toBe(connector.source);
    }
  });

  it("reads real local git commits and markdown documents when mode is local", async () => {
    const now = new Date("2026-11-20T00:00:00.000Z");
    const gitEvents = await gitConnector.fetchSnapshots({
      appcode: "appcode-demo-0",
      binding: {
        source: "git",
        target: process.cwd(),
        mode: "local",
        enabled: true,
      },
      now,
    });
    expect(gitEvents.length).toBeGreaterThan(0);
    expect(gitEvents[0].provenance).toBe("local");
    expect(gitEvents[0].network).toBe(false);
    expect(gitEvents[0].stage).toBe("build");

    const dir = mkdtempSync(join(tmpdir(), "mirevox-sv-"));
    try {
      writeFileSync(join(dir, "discovery.md"), "# Payment Brief\nInitial scope.", "utf8");
      const docEvents = await confluenceConnector.fetchSnapshots({
        appcode: "appcode-demo-0",
        binding: {
          source: "confluence",
          target: dir,
          mode: "local",
          enabled: true,
        },
        now,
      });
      expect(docEvents.length).toBe(1);
      expect(docEvents[0].provenance).toBe("local");
      expect(docEvents[0].title).toBe("Payment Brief");
      expect(docEvents[0].stage).toBe("pre-requirements");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
