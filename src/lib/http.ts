import { NextResponse } from "next/server";
import { validateAppcode } from "./appcode";
import { OwnershipError } from "./sync-model";
import { StoreError } from "./store";

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof StoreError) {
    const status = error.code === "not-found" ? 404 : error.code === "conflict" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof OwnershipError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new StoreError("Request body must be a JSON object", "invalid");
}

export function checkedAppcode(raw: string): string {
  const check = validateAppcode(raw);
  if (!check.ok) throw new StoreError(check.error, "invalid");
  return check.appcode;
}

export type AppcodeContext = { params: Promise<{ appcode: string }> };
