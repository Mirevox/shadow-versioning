import { NextResponse } from "next/server";
import { validateSnapshotContent, validateSnapshotMetadata } from "@/lib/content";
import { notifyStageGateWebhook, pushSnapshotsToContextEngine } from "@/lib/context-bridge";
import { checkedAppcode, errorResponse, readJson, type AppcodeContext } from "@/lib/http";
import { appendSnapshots, getProject, StoreError } from "@/lib/store";
import { isStage, ownerOf, recordStageSnapshot } from "@/lib/sync-model";

export const dynamic = "force-dynamic";

function parseHopCount(raw: unknown, fallbackMeta?: string): number {
  const candidate = raw ?? fallbackMeta;
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return Math.max(0, Math.trunc(candidate));
  }
  if (typeof candidate === "string" && candidate.trim()) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return 0;
}

/**
 * Conceptual stage-gate hook: a gate reports that a stage changed state.
 * The event is attributed to the stage's owning source, recorded locally,
 * optionally bridged to context-engine, and guarded against webhook loops.
 */
export async function POST(request: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const record = getProject(appcode);
    if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
    const body = await readJson(request);
    if (!isStage(body.stage)) throw new StoreError("stage must be a known stage", "invalid");

    const contentCheck = validateSnapshotContent(body.content);
    if (!contentCheck.ok) throw new StoreError(contentCheck.error, "invalid");
    const metaCheck = validateSnapshotMetadata(body.metadata);
    if (!metaCheck.ok) throw new StoreError(metaCheck.error, "invalid");
    const bodyMeta = metaCheck.value;

    const outcome =
      typeof body.outcome === "string" && body.outcome.trim() ? body.outcome.trim() : "entered";
    const originSource =
      typeof body.originSource === "string" && body.originSource.trim()
        ? body.originSource.trim()
        : bodyMeta?.originSource;
    const skipStageGateCallback =
      body.skipStageGateCallback === true ||
      body.skipStageGateCallback === "true" ||
      bodyMeta?.skipStageGateCallback === "true";
    const eventId =
      typeof body.eventId === "string" && body.eventId.trim()
        ? body.eventId.trim()
        : bodyMeta?.eventId;
    const hopCount = parseHopCount(body.hopCount, bodyMeta?.hopCount);

    const metadata: Record<string, string> = {
      ...(bodyMeta ?? {}),
      outcome,
      ...(originSource ? { originSource } : {}),
      skipStageGateCallback: String(skipStageGateCallback),
      hopCount: String(hopCount),
      ...(eventId ? { eventId } : {}),
    };

    const snapshot = recordStageSnapshot(
      {
        appcode,
        stage: body.stage,
        source: ownerOf(body.stage, record.manifest.ownership),
        title: `Stage gate: ${body.stage} ${outcome}`,
        detail:
          typeof body.detail === "string"
            ? body.detail
            : `Gate reported "${outcome}" for ${body.stage}.`,
        content: contentCheck.value,
        metadata,
        eventId,
        ref: typeof body.ref === "string" ? body.ref : null,
        occurredAt:
          typeof body.occurredAt === "string" && !Number.isNaN(Date.parse(body.occurredAt))
            ? new Date(body.occurredAt).toISOString()
            : undefined,
        provenance: "stage-gate",
      },
      record.manifest.ownership,
    );
    const [added] = appendSnapshots(appcode, [snapshot]);
    const contextBridge = added
      ? await pushSnapshotsToContextEngine(record, [added])
      : undefined;
    const stageGateCallback = added
      ? await notifyStageGateWebhook(record, added, {
          originSource,
          skipStageGateCallback,
          eventId,
          hopCount,
        })
      : undefined;

    return NextResponse.json(
      {
        snapshot: added ?? null,
        duplicate: !added,
        ...(contextBridge ? { contextBridge } : {}),
        ...(stageGateCallback ? { stageGateCallback } : {}),
      },
      { status: added ? 201 : 200 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
