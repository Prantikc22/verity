import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateMaestroFlow } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  description: z.string().min(3).max(8000),
  name: z.string().min(1).max(120).optional(),
  suite: z.string().max(120).optional(),
  appId: z.string().max(200).optional(),
  screenContext: z.string().max(20000).optional(),
  needsAuth: z.boolean().optional(),
  criticalPath: z.boolean().optional(),
});

function flowPathFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "flow";
  return `tests/verity/mobile/${slug}.yaml`;
}

/** Authed: generate a Maestro YAML flow and persist it as kind='mobile'. */
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
  const { count: used } = await supabase.from("tests").select("id", { count: "exact", head: true })
    .eq("org_id", project.org_id).gte("created_at", monthStart.toISOString());
  if ((used ?? 0) >= plan.testGensPerMonth) {
    return NextResponse.json({ error: `You've used all ${plan.testGensPerMonth} AI generations on the ${plan.name} plan this month.` }, { status: 402 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a description." }, { status: 400 });
  const { description, appId, screenContext, needsAuth, criticalPath } = parsed.data;
  const name = (parsed.data.name ?? description.slice(0, 60)).slice(0, 60);

  let gen;
  try {
    gen = await generateMaestroFlow({ description, appId, screenContext, needsAuth });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }

  const { data: test, error } = await supabase
    .from("tests")
    .insert({
      project_id: project.id,
      org_id: project.org_id,
      kind: "mobile",
      name,
      suite: parsed.data.suite ?? null,
      description,
      source_url: null,
      spec_path: flowPathFor(name),
      spec_content: gen.specContent,
      plan: gen.plan as unknown as Json,
      source_files: [],
      generated_model: gen.model,
      critical_path: criticalPath ?? false,
      status: "active",
    })
    .select("id, name")
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, test, plan: gen.plan });
}
