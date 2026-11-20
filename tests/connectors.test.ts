import { describe, expect, it } from "vitest";
import { CONNECTORS, STUB_LABEL } from "@/lib/connectors";
import { SOURCE_KINDS } from "@/lib/types";

const now = new Date("2026-03-01T12:00:00.000Z");

describe("connector stubs", () => {
  it("covers every source except stage-gate", () => {
    expect(Object.keys(CONNECTORS).sort()).toEqual(SOURCE_KINDS.filter((s) => s !== "stage-gate").sort());
  });
  it.each(Object.values(CONNECTORS))("$source returns clearly labelled mock snapshots", async (connector) => {
    const events = await connector.fetchSnapshots({
      appcode: "appcode-demo-1",
      now,
      binding: { source: connector.source, target: "x://y", mode: "stub", enabled: true },
    });
    expect(connector.stub).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.source).toBe(connector.source);
      expect(e.appcode).toBe("appcode-demo-1");
      expect(e.provenance).toBe("stub");
      expect(e.upstreamWritten).toBe(false);
      expect(e.title).toContain(STUB_LABEL);
      expect(e.detail).toContain(STUB_LABEL);
      expect(Date.parse(e.occurredAt)).toBeLessThanOrEqual(now.getTime());
    }
  });
});
