import { describe, expect, it } from "vitest";
import {
  DEFAULT_OWNERSHIP,
  OwnershipError,
  ownerOf,
  recordStageSnapshot,
  stageOwnershipComplete,
} from "../src/lib/sync-model";

describe("stage-owned sync model", () => {
  it("maps every default stage to an owner", () => {
    expect(ownerOf("pre-requirements")).toBe("confluence");
    expect(ownerOf("requirements")).toBe("sharepoint");
    expect(ownerOf("build")).toBe("git");
    expect(ownerOf("test")).toBe("testing");
    expect(ownerOf("release")).toBe("stage-gate");
  });

  it("asserts completeness", () => {
    expect(stageOwnershipComplete(DEFAULT_OWNERSHIP)).toBe(true);
    expect(stageOwnershipComplete(DEFAULT_OWNERSHIP.slice(0, 2))).toBe(false);
  });

  it("rejects snapshots from the wrong owner", () => {
    expect(() =>
      recordStageSnapshot({
        appcode: "appcode-demo-0",
        stage: "build",
        source: "confluence",
        title: "Wrong owner",
      }),
    ).toThrow(OwnershipError);
  });
});
