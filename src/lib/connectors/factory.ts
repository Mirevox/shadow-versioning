import type { Stage } from "../types";
import { STUB_LABEL, type Connector, type ConnectorContext } from "./types";
import type { SnapshotEvent } from "../types";

interface StubSpec {
  source: Connector["source"];
  stage: Stage;
  title: string;
  detail: string;
  ref: string;
  /** Minutes before `now` that the mock change supposedly happened. */
  minutesAgo: number;
}

export function makeStubConnector(spec: StubSpec): Connector {
  return {
    source: spec.source,
    stub: true,
    async fetchSnapshots(ctx: ConnectorContext): Promise<SnapshotEvent[]> {
      const occurredAt = new Date(ctx.now.getTime() - spec.minutesAgo * 60_000).toISOString();
      return [
        {
          id: `${ctx.appcode}:${spec.source}:stub:${spec.ref}`,
          appcode: ctx.appcode,
          source: spec.source,
          stage: spec.stage,
          occurredAt,
          recordedAt: ctx.now.toISOString(),
          title: `${STUB_LABEL} ${spec.title}`,
          detail: `${spec.detail} (${STUB_LABEL} Generated locally for ${ctx.binding.target}; no request was sent to ${spec.source}.)`,
          ref: spec.ref,
          provenance: "stub",
          upstreamWritten: false,
        },
      ];
    },
  };
}
