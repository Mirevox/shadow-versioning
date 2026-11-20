import { describe, expect, it } from "vitest";
import {
  DEFAULT_STAGE_OWNERSHIP,
  assertOwnershipComplete,
  ownerForStage,
} from "../src/lib/sync-model";

describe("stage-owned sync model", () => {
  it("maps every default stage to an owner", () => {
    expect(ownerForStage(DEFAULT_STAGE_OWNERSHIP, "pre-requirements")).toBe(
      "confluence",
    );
    expect(ownerForStage(DEFAULT_STAGE_OWNERSHIP, "requirements")).toBe(
      "sharepoint",
    );
    expect(ownerForStage(DEFAULT_STAGE_OWNERSHIP, "build")).toBe("git");
    expect(ownerForStage(DEFAULT_STAGE_OWNERSHIP, "test")).toBe("testing");
    expect(ownerForStage(DEFAULT_STAGE_OWNERSHIP, "release")).toBe("stage-gate");
  });

  it("asserts completeness", () => {
    expect(() => assertOwnershipComplete(DEFAULT_STAGE_OWNERSHIP)).not.toThrow();
    expect(() =>
      assertOwnershipComplete(DEFAULT_STAGE_OWNERSHIP.slice(0, 2)),
    ).toThrow(/No ownership/);
  });
});
