import type { ConnectorBinding, SnapshotEvent, SourceKind } from "../types";

export interface ConnectorContext {
  appcode: string;
  binding: ConnectorBinding;
  now: Date;
}

export interface Connector {
  source: Exclude<SourceKind, "stage-gate">;
  /** Stub connectors return fixed, clearly labelled mock data and make no network calls. */
  stub: true;
  fetchSnapshots(ctx: ConnectorContext): Promise<SnapshotEvent[]>;
}

export const STUB_LABEL = "[stub/mock]";
