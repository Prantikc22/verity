import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { proposeMaestroFlows } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROPOSAL_CEILING = 25;

const Body = z.object({
  appContext: z.string().min(5).max(12000),
  screenContext: z.string().max(20000).optional(),
  platform: z.enum(["android", "ios", "both"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM is not configured." }, { status: 503 });

  const { data: project } = await supabase.from("projects").select("id, org_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Describe your app." }, { status: 400 });

  const { data: org } = await supabase.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count: gensThisMonth }, { count: mobileTests }] = await Promise.all([
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("org_id", project.org_id).gte("created_at", monthStart.toISOString()),
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("kind", "mobile").neq("status", "archived"),
  ]);
  const headroom = Math.max(0, Math.min(plan.testGensPerMonth - (gensThisMonth ?? 0), plan.maxTests - (mobileTests ?? 0)));
  if (headroom <= 0) return NextResponse.json({ error: `You've hit your ${plan.name} plan limit this month. Upgrade for more.` }, { status: 402 });
  const max = Math.min(headroom, PROPOSAL_CEILING);

  try {
    const { candidates } = await proposeMaestroFlows({ appContext: parsed.data.appContext, screenContext: parsed.data.screenContext, platform: parsed.data.platform, max });
    return NextResponse.json({ ok: true, candidates, headroom: { max, plan: plan.name } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "proposal failed" }, { status: 500 });
  }
}
