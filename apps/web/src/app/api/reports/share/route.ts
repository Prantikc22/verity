import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getUser, getPrimaryOrg } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const LINK_DAYS = 7;

/** Create a read-only, expiring link to the current Reports view. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to share a report." }, { status: 401 });
  const orgCtx = await getPrimaryOrg();
  if (!orgCtx) return NextResponse.json({ error: "No organization found." }, { status: 400 });

  let body: { project?: string | null; days?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const days = [7, 14, 30].includes(Number(body.days)) ? Number(body.days) : 14;

  const admin = createAdminClient();
  if (body.project) {
    const { data: p } = await admin.from("projects").select("id").eq("id", body.project).eq("org_id", orgCtx.org.id).maybeSingle();
    if (!p) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + LINK_DAYS * 86400_000).toISOString();
  const { error } = await admin.from("report_shares").insert({
    org_id: orgCtx.org.id, project_id: body.project || null, token, days, expires_at: expires, created_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Could not create the link." }, { status: 500 });

  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  return NextResponse.json({ url: `${origin}/share/r/${token}`, expires_at: expires });
}
