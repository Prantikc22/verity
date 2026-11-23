import { NextResponse, type NextRequest } from "next/server";
import { handleA11yIngest, projectForA11yToken } from "@/lib/a11y/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return NextResponse.json({ error: "Missing ingest token (Authorization: Bearer ...)" }, { status: 401 });
  const project = await projectForA11yToken(token);
  if (!project) return NextResponse.json({ error: "Invalid ingest token" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  return handleA11yIngest(project, body, new URL(req.url).origin);
}
