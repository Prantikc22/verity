import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordRun } from "@/lib/ingest";
import { planFor } from "@/lib/plans";
import { isPublicHttpUrl, runPerfTrial, runSecurityTrial } from "@/lib/cloud-trial";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  discipline: z.enum(["performance", "security"]),
  url: z.string().url(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a discipline and a URL." }, { status: 400 });
  if (!isPublicHttpUrl(parsed.data.url)) {
    return NextResponse.json({ error: "Cloud trials only work against a public http(s) URL. For internal targets, run it in your CI." }, { status: 400 });
  }

  // Cap: cloud trials are tiny but cost us money — 1 on free, 3 on paid. CI is unlimited.
  const { data: org } = await supabase.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count: used } = await supabase
    .from("test_runs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", project.org_id)
    .eq("trigger", "manual")
    .in("discipline", ["performance", "security"])
    .gte("created_at", monthStart.toISOString());
  if ((used ?? 0) >= plan.cloudTrialsPerMonth) {
    return NextResponse.json(
      { error: `Cloud trials are capped at ${plan.cloudTrialsPerMonth}/month on ${plan.name} (they run on our infra). Wire your CI for unlimited runs.`, capped: true },
      { status: 402 },
    );
  }

  try {
    const sha = `cloud-trial-${Date.now()}`;
    if (parsed.data.discipline === "performance") {
      const perf = await runPerfTrial(parsed.data.url);
      const result = await recordRun(project, { tier: "fast", trigger: "manual", commit_sha: sha, branch: "cloud-trial", discipline: "performance", results: [], perf });
      return NextResponse.json({ ok: true, run_id: result.runId, discipline: "performance", perf });
    } else {
      const findings = await runSecurityTrial(parsed.data.url);
      const result = await recordRun(project, { tier: "fast", trigger: "manual", commit_sha: sha, branch: "cloud-trial", discipline: "security", results: [], findings });
      return NextResponse.json({ ok: true, run_id: result.runId, discipline: "security", findings: result.findings });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Trial failed." }, { status: 500 });
  }
}
