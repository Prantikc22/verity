import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateVisualTest } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({
  input: z.string().min(3).max(4000),
  baseUrl: z.string().url().optional(),
  needsAuth: z.boolean().optional(),
});

function specPathFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "screen";
  return `tests/verity/visual/${slug}.spec.ts`;
}

/** Authed: AI-generate a Playwright visual (toHaveScreenshot) spec and persist as kind='visual'. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM is not configured (set LLM_API_KEY)." }, { status: 503 });

  const { data: project } = await supabase.from("projects").select("id, org_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Per-tier monthly generation cap (shared with every other generate route).
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
  const { input, baseUrl, needsAuth } = parsed.data;
  const isUrl = /^https?:\/\//i.test(input.trim());

  let gen;
  try {
    gen = await generateVisualTest({ input, isUrl, baseUrl: baseUrl ?? (isUrl ? input.trim() : undefined), needsAuth });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }

  const name = (isUrl ? `Snapshot: ${input.trim()}` : input.trim()).slice(0, 60);
  const specPath = specPathFor(name);
  const { data: test, error } = await supabase.from("tests").insert({
    project_id: project.id, org_id: project.org_id, kind: "visual",
    name, suite: "Visual", description: isUrl ? null : input.trim(),
    source_url: isUrl ? input.trim() : baseUrl ?? null, spec_path: specPath, spec_content: gen.specContent,
    plan: gen.plan as unknown as Json, source_files: [], generated_model: gen.model, critical_path: false, status: "draft",
  }).select("id").single();
  if (error) { const status = error.code === "42501" ? 403 : 500; return NextResponse.json({ error: error.message }, { status }); }

  return NextResponse.json({ ok: true, testId: test.id, name, spec_path: specPath, assertionCount: gen.assertionCount });
}
