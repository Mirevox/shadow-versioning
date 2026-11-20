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
