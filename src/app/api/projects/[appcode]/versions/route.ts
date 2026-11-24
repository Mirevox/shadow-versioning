import { NextResponse } from "next/server";
import { checkedAppcode, errorResponse, type AppcodeContext } from "@/lib/http";
import { getProject, StoreError } from "@/lib/store";
import { buildAppcodeVersionBundles } from "@/lib/versions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AppcodeContext) {
  try {
    const appcode = checkedAppcode((await params).appcode);
    const record = getProject(appcode);
    if (!record) throw new StoreError(`Project "${appcode}" not found`, "not-found");

    const url = new URL(request.url);
    const rawOrder = url.searchParams.get("order");
    if (rawOrder !== null && rawOrder !== "asc" && rawOrder !== "desc") {
      throw new StoreError('order must be "asc" or "desc"', "invalid");
    }
    const order = rawOrder === "desc" ? "desc" : "asc";

    const ascending = buildAppcodeVersionBundles(record);
    const latestVersion = ascending.length ? ascending[ascending.length - 1].version : null;
    const versions = order === "desc" ? [...ascending].reverse() : ascending;

    return NextResponse.json({
      appcode,
      order,
      latestVersion,
      total: versions.length,
      versions,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
