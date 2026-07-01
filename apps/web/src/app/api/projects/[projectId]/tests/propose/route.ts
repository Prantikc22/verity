import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { proposeTests } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Hard ceiling so a single proposal can't try to blow the whole monthly quota. */
const PROPOSAL_CEILING = 25;

const Body = z.object({
  url: z.string().url().optional(),
  prd: z.string().max(8000).optional(),
}).refine((b) => b.url || b.prd, { message: "Provide a url and/or a PRD." });

/**
 * Explore a URL (+ optional PRD) and propose as many worthwhile tests as the
 * plan still allows this month. Returns candidates only — nothing is saved. The
 * user then picks which to generate (all are pre-selected client-side).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM is not configured." }, { status: 503 });

  const { data: project } = await supabase.from("projects").select("id, org_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a url and/or a PRD." }, { status: 400 });

  // "Generate all possible tests, capped at the tier": the most we can propose is
  // whatever quota remains — min(monthly generations left, suite slots left).
  const { data: org } = await supabase.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count: gensThisMonth }, { count: testsInProject }] = await Promise.all([
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("org_id", project.org_id).gte("created_at", monthStart.toISOString()),
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("project_id", projectId).neq("status", "archived"),
  ]);
  const gensLeft = Math.max(0, plan.testGensPerMonth - (gensThisMonth ?? 0));
  const slotsLeft = Math.max(0, plan.maxTests - (testsInProject ?? 0));
  const headroom = Math.min(gensLeft, slotsLeft);
  if (headroom <= 0) {
    return NextResponse.json(
      { error: gensLeft <= 0
          ? `You've used all ${plan.testGensPerMonth} AI generations on the ${plan.name} plan this month. Upgrade for more.`
          : `Your ${plan.name} plan allows ${plan.maxTests} maintained tests and this project is full. Archive some or upgrade.` },
      { status: 402 },
    );
  }
  const max = Math.min(headroom, PROPOSAL_CEILING);

  try {
    const { candidates, usedLiveContext } = await proposeTests({ ...parsed.data, max });
    return NextResponse.json({
      ok: true,
      candidates,
      used_live_context: usedLiveContext,
      headroom: { max, gensLeft, slotsLeft, plan: plan.name },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "proposal failed" }, { status: 500 });
  }
}
