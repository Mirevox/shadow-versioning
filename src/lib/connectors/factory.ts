import { capContent } from "../content";
import type { NewSnapshot, Stage } from "../types";
import { STUB_LABEL, type Connector, type ConnectorContext } from "./types";

interface StubSpec {
  source: Connector["source"];
  stage: Stage | null;
  title: string;
  detail: string;
  content: string;
  metadata?: Record<string, string>;
  ref: string;
  /** Minutes before `now` that the mock change supposedly happened. */
  minutesAgo: number;
}

export function makeStubConnector(spec: StubSpec): Connector {
  return {
    source: spec.source,
    stub: true,
    async fetchSnapshots(ctx: ConnectorContext): Promise<NewSnapshot[]> {
      const occurredAt = new Date(ctx.now.getTime() - spec.minutesAgo * 60_000).toISOString();
      const metadata: Record<string, string> = {
        mode: "stub",
        source: spec.source,
        target: ctx.binding.target,
        ref: spec.ref,
        ...(spec.stage ? { stageId: spec.stage } : {}),
        ...(spec.metadata ?? {}),
      };
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
          content: capContent(spec.content),
          metadata,
          ref: spec.ref,
          provenance: "stub",
          network: false,
        },
      ];
    },
  };
}
