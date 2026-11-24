import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectorBinding, NewSnapshot, SourceKind } from "../types";

export interface ConnectorContext {
  appcode: string;
  binding: ConnectorBinding;
  now: Date;
}

export interface Connector {
  source: Exclude<SourceKind, "stage-gate">;
  /** Stub connectors return fixed, clearly labelled mock data and make no network calls. */
  stub: true;
  /** Store assigns `sequenceNumber` on append — stubs omit it. */
  fetchSnapshots(ctx: ConnectorContext): Promise<NewSnapshot[]>;
}

export const STUB_LABEL = "[stub/mock]";

/** Resolves a `file://` or custom `<scheme>://` target path into an absolute filesystem path. */
export function resolveLocalTarget(
  target: string,
  schemeRegex: RegExp,
  fallbackCwd = false,
): string {
  if (target.startsWith("file://")) {
    return fileURLToPath(target);
  }
  const stripped = target.replace(schemeRegex, "");
  if (fallbackCwd && (stripped === "." || !stripped)) {
    return process.cwd();
  }
  return resolve(stripped);
}
