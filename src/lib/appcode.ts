const APPCODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const APPCODE_MIN = 3;
export const APPCODE_MAX = 64;

export type AppcodeCheck = { ok: true; appcode: string } | { ok: false; error: string };

/** Appcodes are lowercase, hyphen-separated slugs such as `appcode-demo-0`. */
export function validateAppcode(input: unknown): AppcodeCheck {
  if (typeof input !== "string") return { ok: false, error: "appcode must be a string" };
  const value = input.trim();
  if (value.length < APPCODE_MIN || value.length > APPCODE_MAX) {
    return { ok: false, error: `appcode must be ${APPCODE_MIN}-${APPCODE_MAX} characters long` };
  }
  if (!APPCODE_PATTERN.test(value)) {
    return {
      ok: false,
      error: "appcode must start with a letter and use only lowercase letters, digits and single hyphens",
    };
  }
  return { ok: true, appcode: value };
}

export function isValidAppcode(input: unknown): input is string {
  return validateAppcode(input).ok && input === (input as string).trim();
}
