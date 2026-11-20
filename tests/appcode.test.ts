import { describe, expect, it } from "vitest";
import { validateAppcode } from "@/lib/appcode";

describe("validateAppcode", () => {
  it("accepts the seed appcode", () => {
    expect(validateAppcode("appcode-demo-0")).toEqual({ ok: true, appcode: "appcode-demo-0" });
  });
  it("trims surrounding whitespace", () => {
    expect(validateAppcode("  appcode-loan-intake-12 ")).toEqual({ ok: true, appcode: "appcode-loan-intake-12" });
  });
  it.each(["", "ab", "demo-app", "appcode-demo", "Appcode-Demo-0", "appcode--demo-0", "appcode-demo-x", "appcode demo-0", `appcode-${"a".repeat(60)}-1`])(
    "rejects %j",
    (value) => {
      expect(validateAppcode(value).ok).toBe(false);
    },
  );
  it("rejects non-strings", () => {
    expect(validateAppcode(42).ok).toBe(false);
    expect(validateAppcode(undefined).ok).toBe(false);
  });
});
