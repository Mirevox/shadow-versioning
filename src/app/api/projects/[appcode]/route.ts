import { NextResponse } from "next/server";
import { checkedAppcode, errorResponse, type AppcodeContext } from "@/lib/http";
import { getProject, StoreError } from "@/lib/store";

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
