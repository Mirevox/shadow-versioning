import { describe, expect, it } from "vitest";
import { CONNECTORS } from "../src/lib/connectors";
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
});
