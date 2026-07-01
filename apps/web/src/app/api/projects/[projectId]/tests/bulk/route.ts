import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["activate", "archive", "draft", "delete", "move"]),
  suite: z.string().max(120).nullable().optional(),
});

/**
 * Bulk operations on a project's tests: activate / archive / set-draft / delete,
 * or move into a set (suite). RLS enforces that only an org admin/owner can write.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide { ids[], action }." }, { status: 400 });
  const { ids, action, suite } = parsed.data;

  let q;
  if (action === "delete") {
    q = supabase.from("tests").delete().eq("project_id", projectId).in("id", ids);
  } else if (action === "move") {
    q = supabase.from("tests").update({ suite: suite ?? null, updated_at: new Date().toISOString() }).eq("project_id", projectId).in("id", ids);
  } else {
    const status = action === "activate" ? "active" : action === "archive" ? "archived" : "draft";
    q = supabase.from("tests").update({ status, updated_at: new Date().toISOString() }).eq("project_id", projectId).in("id", ids);
  }

  const { error } = await q;
  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Only org admins can change tests." : error.message }, { status });
  }
  return NextResponse.json({ ok: true, count: ids.length });
}
