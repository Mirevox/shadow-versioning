import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { dataDir } from "@/lib/store";

export const dynamic = "force-dynamic";

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
      version: process.env.npm_package_version ?? "0.1.0",
      dataDir: dir,
      dataReady,
    },
    { status: 200 },
  );
}
