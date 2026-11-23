import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPrimaryOrg } from "@/lib/auth";
import { setWorkspaceMode } from "@/lib/workspace";

const Body = z.object({ mode: z.enum(["full", "reports"]) });

/** Switch the workspace navigation. Owners and admins only; same login, same data either way. */
export async function POST(req: NextRequest) {
  const ctx = await getPrimaryOrg();
  if (!ctx) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Ask an owner or admin of your workspace to change this." }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  await setWorkspaceMode(ctx.org.id, parsed.data.mode);
  return NextResponse.json({ ok: true, mode: parsed.data.mode });
}
