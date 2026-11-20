import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/http";
import { createProject, listProjects, type CreateProjectInput } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ projects: listProjects() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const record = createProject((await readJson(request)) as unknown as CreateProjectInput);
    return NextResponse.json(record, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
