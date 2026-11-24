import type { ProjectRecord, SnapshotEvent } from "./types";

const DEFAULT_BRIDGE_TIMEOUT_MS = 2500;
export const MAX_STAGE_GATE_HOPS = 3;

export interface ContextBridgeOptions {
  contextEngineUrl?: string;
  token?: string;
  timeoutMs?: number;
}

export interface ContextBridgeResult {
  attempted: boolean;
  ok: boolean;
  status?: number;
  pushed: number;
  skippedReason?: "unconfigured" | "empty";
  error?: string;
}

export interface StageGateLoopGuard {
  originSource?: string;
  skipStageGateCallback?: boolean;
  eventId?: string;
  hopCount?: number;
}

export interface StageGateWebhookResult {
  attempted: boolean;
  ok: boolean;
  status?: number;
  skippedReason?: "unconfigured" | "loop-guard";
  error?: string;
}

function resolveOptionalUrl(explicit: string | undefined, envKey: string): string | null {
  const raw = explicit ?? process.env[envKey] ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : null;
}

function buildIngestDocument(record: ProjectRecord, snapshot: SnapshotEvent) {
  const appcode = record.manifest.appcode;
  const content = snapshot.content?.trim() || snapshot.detail?.trim() || snapshot.title;
  const pathHint =
    snapshot.metadata?.filePath ??
    snapshot.ref ??
    `${snapshot.source}/${snapshot.id}`;
  return {
    docId: snapshot.id,
    id: snapshot.id,
    appcode,
    source: snapshot.source,
    stage: snapshot.stage,
    uri: pathHint,
    path: pathHint,
    title: snapshot.title,
    detail: snapshot.detail,
    content,
    ref: snapshot.ref,
    provenance: snapshot.provenance,
    occurredAt: snapshot.occurredAt,
    recordedAt: snapshot.recordedAt,
    sequenceNumber: snapshot.sequenceNumber,
    metadata: {
      ...(snapshot.metadata ?? {}),
      provenance: snapshot.provenance,
      snapshotId: snapshot.id,
      sequenceNumber: String(snapshot.sequenceNumber),
      ...(snapshot.stage ? { stage: snapshot.stage } : {}),
      ...(snapshot.ref ? { ref: snapshot.ref } : {}),
    },
  };
}

/**
 * Pushes newly recorded snapshots to `context-engine`'s `/appcodes/:appcode/ingest`
 * endpoint lazily at request time. Empty `CONTEXT_ENGINE_URL` is treated as unset,
 * and offline / 404 responses never throw or block shadow-versioning writes.
 */
export async function pushSnapshotsToContextEngine(
  record: ProjectRecord,
  snapshots: readonly SnapshotEvent[],
  opts?: ContextBridgeOptions,
): Promise<ContextBridgeResult> {
  const baseUrl = resolveOptionalUrl(opts?.contextEngineUrl, "CONTEXT_ENGINE_URL");
  if (!baseUrl) {
    return { attempted: false, ok: false, pushed: 0, skippedReason: "unconfigured" };
  }
  if (!snapshots.length) {
    return { attempted: false, ok: false, pushed: 0, skippedReason: "empty" };
  }

  const appcode = record.manifest.appcode;
  const endpoint = `${baseUrl}/appcodes/${encodeURIComponent(appcode)}/ingest`;
  const token = (opts?.token ?? process.env.CONTEXT_ENGINE_TOKEN ?? "").trim();
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS;
  const documents = snapshots.map((snapshot) => buildIngestDocument(record, snapshot));

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        appcode,
        projectName: record.manifest.name,
        docs: documents,
        documents,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return {
        attempted: true,
        ok: false,
        status: res.status,
        pushed: 0,
        error: `HTTP ${res.status}`,
      };
    }
    return {
      attempted: true,
      ok: true,
      status: res.status,
      pushed: documents.length,
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      pushed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Loop-guard predicate preventing ping-pong callbacks between shadow-versioning and stage-gate. */
export function shouldSkipStageGateCallback(guard: StageGateLoopGuard): boolean {
  return (
    guard.originSource === "stage-gate" ||
    guard.skipStageGateCallback === true ||
    (typeof guard.hopCount === "number" && guard.hopCount > MAX_STAGE_GATE_HOPS)
  );
}

/**
 * Optional outbound notification to `STAGE_GATE_WEBHOOK_URL`.
 * Enforces loop guards and never throws when the webhook endpoint is offline.
 */
export async function notifyStageGateWebhook(
  record: ProjectRecord,
  snapshot: SnapshotEvent,
  guard: StageGateLoopGuard,
  opts?: { webhookUrl?: string; timeoutMs?: number },
): Promise<StageGateWebhookResult> {
  if (shouldSkipStageGateCallback(guard)) {
    return { attempted: false, ok: false, skippedReason: "loop-guard" };
  }
  const webhookUrl = resolveOptionalUrl(opts?.webhookUrl, "STAGE_GATE_WEBHOOK_URL");
  if (!webhookUrl) {
    return { attempted: false, ok: false, skippedReason: "unconfigured" };
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appcode: record.manifest.appcode,
        snapshotId: snapshot.id,
        stage: snapshot.stage,
        source: snapshot.source,
        title: snapshot.title,
        occurredAt: snapshot.occurredAt,
        originSource: "shadow-versioning",
        hopCount: (guard.hopCount ?? 0) + 1,
        ...(guard.eventId ? { eventId: guard.eventId } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      attempted: true,
      ok: res.ok,
      status: res.status,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
