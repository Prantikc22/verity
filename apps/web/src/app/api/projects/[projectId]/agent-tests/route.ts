import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { proposeAgentEvals, generateAgentEval, generateAgentEvalSuite } from "@/lib/llm/generate";
import { AGENT_SUITE_PATH, AGENT_REDTEAM_PACK } from "@qashift/verity-core";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  featureContext: z.string().min(10).max(4000),
  endpoint: z.string().url().optional(),
  auth: z.string().max(200).optional(),
  max: z.number().int().positive().max(8).default(4),
  // "specs" (default): one Playwright eval file per case. "suite": one scored
  // eval-suite file (built-in adversarial pack + AI-written cases).
  mode: z.enum(["specs", "suite"]).default("specs"),
  requestField: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(40).optional(),
  responsePath: z.string().max(120).optional(),
  aiGrading: z.boolean().default(false),
});

function specPathFor(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "eval";
  return `tests/verity/agent/${slug}-${randomUUID().slice(0, 8)}.spec.ts`;
}

/**
 * Authed: propose eval cases for the customer's AI feature, then AI-generate the
 * top ones (bounded by the plan's generation + maintained-test headroom) and
 * persist as kind='agent'.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM is not configured (set LLM_API_KEY)." }, { status: 503 });

  const { data: project } = await supabase.from("projects").select("id, org_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: org } = await supabase.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count: gensThisMonth }, { count: testsInProject }] = await Promise.all([
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("org_id", project.org_id).gte("created_at", monthStart.toISOString()),
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("project_id", project.id).neq("status", "archived"),
  ]);
  const headroom = Math.max(0, Math.min(plan.testGensPerMonth - (gensThisMonth ?? 0), plan.maxTests - (testsInProject ?? 0)));
  if (headroom <= 0) {
    return NextResponse.json({ error: `You're at your ${plan.name} plan's generation or maintained-test limit. Upgrade or archive some tests.` }, { status: 402 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request." }, { status: 400 });
  const { featureContext, endpoint, auth, max, mode } = parsed.data;

  const toGenerate = Math.min(max, headroom);

  if (mode === "suite") {
    try {
      // The suite is ONE maintained file (one generation), upserted by path.
      const gen = await generateAgentEvalSuite({
        featureContext, endpointContext: endpoint, max: Math.max(max, 6), allowGrader: parsed.data.aiGrading,
        requestField: parsed.data.requestField, responsePath: parsed.data.responsePath,
      });
      await supabase.from("tests").update({ status: "archived" }).eq("project_id", project.id).eq("kind", "agent").eq("spec_path", AGENT_SUITE_PATH).neq("status", "archived");
      const name = "Agent eval suite";
      const { error } = await supabase.from("tests").insert({
        project_id: project.id, org_id: project.org_id, kind: "agent",
        name, suite: "Agent", description: `${AGENT_REDTEAM_PACK.length} built-in adversarial checks + ${gen.caseCount} cases for this feature.`,
        source_url: endpoint ?? null, spec_path: AGENT_SUITE_PATH, spec_content: gen.specContent,
        plan: gen.plan as unknown as Json, source_files: [], generated_model: gen.model, critical_path: false, status: "draft",
      });
      if (error) { const status = error.code === "42501" ? 403 : 500; return NextResponse.json({ error: error.message }, { status }); }
      return NextResponse.json({ ok: true, saved: [{ name, spec_path: AGENT_SUITE_PATH }], cases: gen.caseCount + AGENT_REDTEAM_PACK.length });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
    }
  }

  try {
    const { candidates } = await proposeAgentEvals({ featureContext, endpointContext: endpoint, max: toGenerate });
    if (candidates.length === 0) return NextResponse.json({ error: "Couldn't propose evals from that description — add more detail about what the AI feature does." }, { status: 422 });

    const saved: { name: string; spec_path: string }[] = [];
    for (const c of candidates.slice(0, toGenerate)) {
      const description = `${c.title}\nIntent: ${c.intent}\nSteps:\n- ${c.plan.join("\n- ")}`;
      const gen = await generateAgentEval({ description, endpoint, auth });
      const specPath = specPathFor(c.title);
      const { error } = await supabase.from("tests").insert({
        project_id: project.id, org_id: project.org_id, kind: "agent",
        name: c.title.slice(0, 60), suite: "Agent", description: c.intent,
        source_url: endpoint ?? null, spec_path: specPath, spec_content: gen.specContent,
        plan: gen.plan as unknown as Json, source_files: [], generated_model: gen.model, critical_path: false, status: "draft",
      });
      if (error) { const status = error.code === "42501" ? 403 : 500; return NextResponse.json({ error: error.message }, { status }); }
      saved.push({ name: c.title, spec_path: specPath });
    }
    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }
}
