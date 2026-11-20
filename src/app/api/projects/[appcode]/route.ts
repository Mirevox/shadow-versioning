import { NextResponse } from "next/server";
import { checkedAppcode, errorResponse, readJson, type AppcodeContext } from "@/lib/http";
import { getProject, StoreError, updateProject } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const record = getProject(appcode);
    if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");
    return NextResponse.json(record);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Update name/description/owner/bindings without clearing snapshot history. */
export async function PATCH(request: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const body = await readJson(request);
    const record = updateProject(appcode, {
      name: body.name,
      description: body.description,
      owner: body.owner,
      bindings: body.bindings,
    });
    return NextResponse.json(record);
  } catch (e) {
    return errorResponse(e);
  }
}
