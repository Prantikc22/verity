import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectFromToken } from "@/lib/mcp-auth";

export const runtime = "nodejs";

/** List the project's tests (for the MCP server). Auth: project token. */
export async function GET(req: NextRequest) {
  const project = await projectFromToken(req);
  if (!project) return NextResponse.json({ error: "Invalid project token" }, { status: 401 });

  const admin = createAdminClient();
  const { data: tests } = await admin
    .from("tests")
    .select("id, name, spec_path, source_url, source_files, status, origin, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    ok: true,
    project: { id: project.id, name: project.name, default_branch: project.default_branch },
    tests: tests ?? [],
  });
}
