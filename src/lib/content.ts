import { MAX_CONTENT_CHARS } from "./types";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Trims leading/trailing whitespace and caps artifact body text at MAX_CONTENT_CHARS. */
export function capContent(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > MAX_CONTENT_CHARS
    ? trimmed.slice(0, MAX_CONTENT_CHARS)
    : trimmed;
}

/** Validates and normalizes optional snapshot `content` input. */
export function validateSnapshotContent(raw: unknown): ValidationResult<string | undefined> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "snapshot content must be a string" };
  }
  const normalized = capContent(raw);
  return { ok: true, value: normalized ? normalized : undefined };
}

/**
 * Validates and normalizes optional snapshot `metadata` into a plain string map.
 * Rejects arrays, primitives, and nested objects/arrays.
 */
export function validateSnapshotMetadata(
  raw: unknown,
): ValidationResult<Record<string, string> | undefined> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "snapshot metadata must be a plain object" };
  }
  const out: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(raw as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (rawVal === undefined || rawVal === null) continue;
    if (typeof rawVal === "string") {
      out[key] = rawVal;
    } else if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
      out[key] = String(rawVal);
    } else if (typeof rawVal === "boolean") {
      out[key] = String(rawVal);
    } else {
      return {
        ok: false,
        error: `snapshot metadata["${key}"] must be a string, finite number, or boolean`,
      };
    }
  }
  return { ok: true, value: Object.keys(out).length > 0 ? out : undefined };
}
