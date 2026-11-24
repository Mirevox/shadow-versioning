import { NextResponse } from "next/server";
import { validateSnapshotContent, validateSnapshotMetadata } from "@/lib/content";
import { pushSnapshotsToContextEngine } from "@/lib/context-bridge";
import { checkedAppcode, errorResponse, readJson, type AppcodeContext } from "@/lib/http";
import { appendSnapshots, getProject, StoreError } from "@/lib/store";
import { isStage, recordStageSnapshot } from "@/lib/sync-model";
import { SOURCE_KINDS, type SourceKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const record = getProject(appcode);
    if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
    return NextResponse.json({ appcode, snapshots: record.snapshots });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Records one snapshot that an operator or script observed upstream. Nothing is written upstream. */
export async function POST(request: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const record = getProject(appcode);
    if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
    const body = await readJson(request);
    if (!SOURCE_KINDS.includes(body.source as SourceKind)) {
      throw new StoreError(`source must be one of ${SOURCE_KINDS.join(", ")}`, "invalid");
    }
    if (!isStage(body.stage)) throw new StoreError("stage must be a known stage", "invalid");
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new StoreError("title is required", "invalid");
    }
    if (body.occurredAt !== undefined && Number.isNaN(Date.parse(String(body.occurredAt)))) {
      throw new StoreError("occurredAt must be an ISO date string", "invalid");
    }
    const contentCheck = validateSnapshotContent(body.content);
    if (!contentCheck.ok) throw new StoreError(contentCheck.error, "invalid");
    const metaCheck = validateSnapshotMetadata(body.metadata);
    if (!metaCheck.ok) throw new StoreError(metaCheck.error, "invalid");
    const eventId =
      typeof body.eventId === "string" && body.eventId.trim() ? body.eventId.trim() : undefined;

    const snapshot = recordStageSnapshot(
      {
        appcode,
        stage: body.stage,
        source: body.source as SourceKind,
        title: body.title.trim(),
        detail: typeof body.detail === "string" ? body.detail : undefined,
        content: contentCheck.value,
        metadata: metaCheck.value,
        eventId,
        ref: typeof body.ref === "string" ? body.ref : null,
        occurredAt:
          body.occurredAt === undefined
            ? undefined
            : new Date(String(body.occurredAt)).toISOString(),
        provenance: "manual",
      },
      record.manifest.ownership,
    );
    const [added] = appendSnapshots(appcode, [snapshot]);
    const contextBridge = added
      ? await pushSnapshotsToContextEngine(record, [added])
      : undefined;
    return NextResponse.json(
      {
        snapshot: added ?? null,
        duplicate: !added,
        ...(contextBridge ? { contextBridge } : {}),
      },
      { status: added ? 201 : 200 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
