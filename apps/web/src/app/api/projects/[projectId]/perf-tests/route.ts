import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateK6Script } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";
import { PERF_PROFILE_NAMES } from "@qashift/verity-core";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 90;

const K6_PATH = "tests/verity/perf/verity.k6.js";

const Body = z.object({
  spec: z.string().max(60000).optional(),
  specUrl: z.string().url().optional(),
  baseUrl: z.string().url(),
  instructions: z.string().max(4000).optional(),
  // Load knobs baked into the generated script as defaults (overridable via env
  // at run time). One script runs every profile; these size the peak.
  vus: z.number().int().positive().max(10000).optional(),
  durationSec: z.number().int().positive().max(7200).optional(),
});

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

  const saved: { name: string; spec_path: string }[] = [];
  try {
    const gen = await generateK6Script({
      spec, baseUrl: parsed.data.baseUrl, instructions: parsed.data.instructions,
      defaults: { vus: parsed.data.vus, duration: parsed.data.durationSec ? `${parsed.data.durationSec}s` : undefined },
    });
    const name = "Performance suite (k6)";
    // Upsert-by-path: archive any existing config at this path, then insert fresh.
    await supabase.from("tests").update({ status: "archived" }).eq("project_id", project.id).eq("kind", "performance").eq("spec_path", K6_PATH).neq("status", "archived");
    const { error } = await supabase.from("tests").insert({
      project_id: project.id, org_id: project.org_id, kind: "performance",
      name, suite: "Performance", description: parsed.data.instructions ?? `Load/spike/soak/stress profiles for ${parsed.data.baseUrl}`,
      source_url: parsed.data.baseUrl, spec_path: K6_PATH, spec_content: gen.specContent,
      plan: gen.plan as unknown as Json, source_files: [], generated_model: gen.model, critical_path: false, status: "active",
    });
    if (error) { const status = error.code === "42501" ? 403 : 500; return NextResponse.json({ error: error.message }, { status }); }
    saved.push({ name, spec_path: K6_PATH });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved, profiles: PERF_PROFILE_NAMES });
}
