import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateArtilleryScenario } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({
  spec: z.string().max(60000).optional(),
  specUrl: z.string().url().optional(),
  baseUrl: z.string().url(),
  instructions: z.string().max(4000).optional(),
  // which tiers to generate
  smoke: z.boolean().default(true),
  full: z.boolean().default(true),
  load: z.object({ durationSec: z.number().int().positive().max(7200), arrivalRate: z.number().int().positive().max(10000), rampToRate: z.number().int().positive().max(10000).optional() }).optional(),
}).refine((b) => b.smoke || b.full, { message: "Pick at least one tier (smoke and/or full)." });

async function fetchSpec(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json, application/yaml, text/yaml, text/plain" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 60000);
  } catch { return null; }
}

/** Authed: generate Artillery config(s) (smoke and/or full) and persist as kind='performance'. */
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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request." }, { status: 400 });
  let spec = parsed.data.spec;
  if (!spec && parsed.data.specUrl) {
    spec = (await fetchSpec(parsed.data.specUrl)) ?? undefined;
    if (!spec) return NextResponse.json({ error: "Couldn't fetch that spec URL. Paste the spec text instead." }, { status: 400 });
  }

  const tiers: { tier: "fast" | "full"; path: string; name: string }[] = [];
  if (parsed.data.smoke) tiers.push({ tier: "fast", path: "tests/verity/perf/smoke.yml", name: "Perf smoke check" });
  if (parsed.data.full) tiers.push({ tier: "full", path: "tests/verity/perf/load.yml", name: "Full load test" });

  const saved: { name: string; spec_path: string }[] = [];
  try {
    for (const t of tiers) {
      const gen = await generateArtilleryScenario({ spec, baseUrl: parsed.data.baseUrl, tier: t.tier, load: t.tier === "full" ? parsed.data.load : undefined, instructions: parsed.data.instructions });
      // Upsert-by-path: archive any existing config at this path, then insert fresh.
      await supabase.from("tests").update({ status: "archived" }).eq("project_id", project.id).eq("kind", "performance").eq("spec_path", t.path).neq("status", "archived");
      const { error } = await supabase.from("tests").insert({
        project_id: project.id, org_id: project.org_id, kind: "performance",
        name: t.name, suite: "Performance", description: parsed.data.instructions ?? `${t.name} for ${parsed.data.baseUrl}`,
        source_url: parsed.data.baseUrl, spec_path: t.path, spec_content: gen.specContent,
        plan: gen.plan as unknown as Json, source_files: [], generated_model: gen.model, critical_path: false, status: "active",
      });
      if (error) { const status = error.code === "42501" ? 403 : 500; return NextResponse.json({ error: error.message }, { status }); }
      saved.push({ name: t.name, spec_path: t.path });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved });
}
