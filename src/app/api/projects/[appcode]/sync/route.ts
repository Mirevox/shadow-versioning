import { NextResponse } from "next/server";
import { checkedAppcode, errorResponse, type AppcodeContext } from "@/lib/http";
import { appendSnapshots, getProject, StoreError } from "@/lib/store";
import { runStubSync } from "@/lib/sync-model";

export const dynamic = "force-dynamic";

/** Runs the stub connectors for every stage-owning source and records what they report. */
export async function POST(_req: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const record = getProject(appcode);
    if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
    const events = await runStubSync(record.manifest);
    const added = appendSnapshots(appcode, events);
    return NextResponse.json({
      appcode,
      mode: "stub",
      note: "Connectors are stubs: events are mock data and nothing was written to any upstream system.",
      fetched: events.length,
      added: added.length,
      snapshots: added,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
