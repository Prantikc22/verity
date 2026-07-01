import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { proposeApiTests } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROPOSAL_CEILING = 25;

const Body = z.object({
  spec: z.string().max(60000).optional(),
  specUrl: z.string().url().optional(),
  instructions: z.string().max(8000).optional(),
  baseUrl: z.string().url().optional(),
}).refine((b) => b.spec || b.specUrl || b.instructions, { message: "Provide an OpenAPI spec (URL or text) and/or instructions." });

/** Fetch an OpenAPI/Swagger document and return its text (size-capped). */
async function fetchSpec(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json, application/yaml, text/yaml, text/plain" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 60000);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM is not configured." }, { status: 503 });

  const { data: project } = await supabase.from("projects").select("id, org_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request." }, { status: 400 });

  let spec = parsed.data.spec;
  if (!spec && parsed.data.specUrl) {
    spec = (await fetchSpec(parsed.data.specUrl)) ?? undefined;
    if (!spec) return NextResponse.json({ error: "Couldn't fetch that spec URL. Paste the spec text instead." }, { status: 400 });
  }

  // Tier headroom (shared monthly generation budget + API test slots).
  const { data: org } = await supabase.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count: gensThisMonth }, { count: apiTests }] = await Promise.all([
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("org_id", project.org_id).gte("created_at", monthStart.toISOString()),
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("kind", "api").neq("status", "archived"),
  ]);
  const headroom = Math.max(0, Math.min(plan.testGensPerMonth - (gensThisMonth ?? 0), plan.maxTests - (apiTests ?? 0)));
  if (headroom <= 0) return NextResponse.json({ error: `You've hit your ${plan.name} plan limit this month. Upgrade for more.` }, { status: 402 });
  const max = Math.min(headroom, PROPOSAL_CEILING);

  try {
    const { candidates } = await proposeApiTests({ spec, instructions: parsed.data.instructions, baseUrl: parsed.data.baseUrl, max });
    // Return the resolved spec (capped) so generation can reuse it for grounding.
    return NextResponse.json({ ok: true, candidates, spec_used: !!spec, resolved_spec: spec ? spec.slice(0, 20000) : null, headroom: { max, plan: plan.name } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "proposal failed" }, { status: 500 });
  }
}
