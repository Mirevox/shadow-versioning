import { describe, expect, it } from "vitest";
import { isValidAppcode } from "../src/lib/types";

describe("appcode validation", () => {
  it("accepts appcode-slug-n", () => {
    expect(isValidAppcode("appcode-demo-0")).toBe(true);
    expect(isValidAppcode("appcode-loan-intake-12")).toBe(true);
  });

  it("rejects git-shaped or bare ids", () => {
    expect(isValidAppcode("demo-0")).toBe(false);
    expect(isValidAppcode("appcode-Demo-0")).toBe(false);
    expect(isValidAppcode("appcode-demo")).toBe(false);
    expect(isValidAppcode("APPCODE-demo-0")).toBe(false);
  });
});
