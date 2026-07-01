import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";

const Body = z.object({ url: z.string().url(), testId: z.string().uuid().optional() });

/**
 * Cloud exploration — opens the URL in a REAL browser on the Fly runner and
 * streams screenshots back (via /api/explore-callback) so the dashboard shows
 * the run happening. Capped per plan: this is the "get the feel" path; real,
 * unlimited runs belong in CI.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("id, org_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide { url }." }, { status: 400 });
  const { url, testId } = parsed.data;

  const runnerUrl = process.env.RUNNER_SERVICE_URL;
  const runnerToken = process.env.RUNNER_SERVICE_TOKEN;
  if (!runnerUrl || !runnerToken) {
    return NextResponse.json({ error: "Cloud runner isn't configured. Use CI for runs — it's unlimited." }, { status: 503 });
  }

  const admin = createAdminClient();

  // Cap cloud runs per plan (cloud is intentionally limited).
  const { data: org } = await admin.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count: usedThisMonth } = await admin
    .from("explorations").select("id", { count: "exact", head: true })
    .eq("org_id", project.org_id).gte("created_at", monthStart.toISOString());
  if ((usedThisMonth ?? 0) >= plan.cloudRunsPerMonth) {
    return NextResponse.json(
      { error: `Cloud runs are capped at ${plan.cloudRunsPerMonth}/mo on ${plan.name} — they're just for the feel. Run unlimited in your CI.` },
      { status: 402 },
    );
  }

  const { data: exp } = await admin
    .from("explorations")
    .insert({ project_id: project.id, org_id: project.org_id, test_id: testId ?? null, url, status: "running", steps: [] })
    .select("id").single();
  const expId = exp!.id;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");

  // Kick off the run on the Fly runner; it streams frames back via the callback.
  try {
    const res = await fetch(`${runnerUrl.replace(/\/$/, "")}/explore`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${runnerToken}` },
      body: JSON.stringify({
        url,
        explorationId: expId,
        callbackUrl: `${appUrl}/api/explore-callback`,
        callbackToken: runnerToken,
      }),
    });
    if (!res.ok && res.status !== 202) throw new Error(`runner responded ${res.status}`);
  } catch (err) {
    await admin.from("explorations").update({
      status: "error",
      error: err instanceof Error ? err.message : "runner unreachable",
      completed_at: new Date().toISOString(),
    }).eq("id", expId);
    return NextResponse.json({ ok: false, exploration_id: expId, error: "Couldn't reach the cloud runner. Use CI for runs — it's unlimited." }, { status: 200 });
  }

  return NextResponse.json({ ok: true, exploration_id: expId, status: "running", steps: [] });
}

/** Poll the live state of an exploration (the dashboard watches frames appear). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("explorations").select("id, status, steps, error, url")
    .eq("id", id).eq("project_id", projectId).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
