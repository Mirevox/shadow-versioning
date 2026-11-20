import { describe, expect, it } from "vitest";
import { listStubConnectors } from "../src/lib/connectors";

describe("connector stubs", () => {
  it("exposes confluence, sharepoint, git, testing", async () => {
    const kinds = listStubConnectors().map((c) => c.kind).sort();
    expect(kinds).toEqual(["confluence", "git", "sharepoint", "testing"]);

    for (const connector of listStubConnectors()) {
      const events = await connector.pull({
        appcode: "appcode-demo-0",
        ref: "stub://x",
        now: new Date("2026-11-20T00:00:00.000Z"),
      });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].stub).toBe(true);
      expect(events[0].source).toBe(connector.kind);
      expect(events[0].title.length).toBeGreaterThan(3);
    }
  });
});
