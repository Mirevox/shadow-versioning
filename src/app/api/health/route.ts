import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness for standalone runs — no stage-gate dependency. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mirevox-shadow-versioning",
    version: "0.1.0",
  });
}
