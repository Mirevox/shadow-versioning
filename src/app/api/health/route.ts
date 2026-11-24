import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { dataDir } from "@/lib/store";

export const dynamic = "force-dynamic";

const SERVICE_VERSION = "0.2.0";

/**
 * Liveness/readiness for Docker HEALTHCHECK and compose.
 * Standalone — zero dependency on stage-gate or external SaaS.
 */
export async function GET() {
  const dir = dataDir();
  const dataReady = existsSync(dir);

  return NextResponse.json(
    {
      status: "ok",
      ok: true,
      service: "mirevox-shadow-versioning",
      version: SERVICE_VERSION,
      dataDir: dir,
      dataReady,
    },
    { status: 200 },
  );
}
