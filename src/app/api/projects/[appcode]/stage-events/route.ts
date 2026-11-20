import { NextResponse } from "next/server";
import { checkedAppcode, errorResponse, readJson, type AppcodeContext } from "@/lib/http";
import { appendSnapshots, getProject, StoreError } from "@/lib/store";
import { isStage, ownerOf, recordStageSnapshot } from "@/lib/sync-model";

export const dynamic = "force-dynamic";

/**
 * Conceptual stage-gate hook: a gate reports that a stage changed state.
 * The event is attributed to the stage's owning source and kept as a local
 * snapshot. No call is made back to the gate or any other system.
 */
export async function POST(request: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const record = getProject(appcode);
    if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
    const body = await readJson(request);
    if (!isStage(body.stage)) throw new StoreError("stage must be a known stage", "invalid");
    const outcome = typeof body.outcome === "string" && body.outcome.trim() ? body.outcome.trim() : "entered";
    const snapshot = recordStageSnapshot(
      {
        appcode,
        stage: body.stage,
        source: ownerOf(body.stage, record.manifest.ownership),
        title: `Stage gate: ${body.stage} ${outcome}`,
        detail: typeof body.detail === "string" ? body.detail : `Gate reported "${outcome}" for ${body.stage}.`,
        ref: typeof body.ref === "string" ? body.ref : null,
        occurredAt: typeof body.occurredAt === "string" && !Number.isNaN(Date.parse(body.occurredAt))
          ? new Date(body.occurredAt).toISOString()
          : undefined,
        provenance: "stage-gate",
      },
      record.manifest.ownership,
    );
    const [added] = appendSnapshots(appcode, [snapshot]);
    return NextResponse.json({ snapshot: added ?? null, duplicate: !added }, { status: added ? 201 : 200 });
  } catch (e) {
    return errorResponse(e);
  }
}
