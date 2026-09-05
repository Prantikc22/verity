import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { generateTest } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  /** The page to test — Verity fetches it for real locators. */
  url: z.string().url().optional(),
  /** A natural-language flow description. */
  description: z.string().max(8000).optional(),
  /** Legacy single field (URL or flow). */
  input: z.string().max(8000).optional(),
  /** Optional PRD / acceptance criteria for richer coverage. */
  prd: z.string().max(6000).optional(),
  /** Flow needs login — the spec reads creds from env vars. */
  needsAuth: z.boolean().optional(),
  /** Credentials the user supplied for this app (used literally in the spec). */
  username: z.string().max(200).optional(),
  password: z.string().max(200).optional(),
  name: z.string().min(1).max(120).optional(),
  /** Test set / suite this test belongs to (groups a generated batch). */
  suite: z.string().max(120).optional(),
  /** Source files this spec exercises — feeds diff-aware (fast-tier) selection. */
  sourceFiles: z.array(z.string()).optional(),
  criticalPath: z.boolean().optional(),
}).refine((b) => b.url || b.description || b.input, { message: "Provide a url and/or a description." });

function specPathFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "flow";
  return `tests/${slug}-${randomUUID().slice(0, 8)}.spec.ts`;
}

/**
 * Authed: generate a Playwright test from a URL or NL flow and persist it to the
 * project. RLS + an explicit membership check guard org access.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!llmConfig().configured) {
    return NextResponse.json({ error: "LLM is not configured (set LLM_API_KEY)." }, { status: 503 });
  }

  // RLS lets a member read the project; confirm it exists + grab org_id.
  const { data: project } = await supabase
    .from("projects")
    .select("id, org_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Per-tier monthly generation cap.
  const { data: org } = await supabase.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: usedThisMonth } = await supabase
    .from("tests")
    .select("id", { count: "exact", head: true })
    .eq("org_id", project.org_id)
    .gte("created_at", monthStart.toISOString());
  if ((usedThisMonth ?? 0) >= plan.testGensPerMonth) {
    return NextResponse.json(
      { error: `You've used all ${plan.testGensPerMonth} AI generations on the ${plan.name} plan this month. Upgrade for more.` },
      { status: 402 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a url and/or a description." }, { status: 400 });
  }
  const { sourceFiles, criticalPath, prd, needsAuth } = parsed.data;

  // Normalize: a URL (fetched for real locators) and/or an NL flow description.
  const url = parsed.data.url ?? (parsed.data.input && /^https?:\/\//i.test(parsed.data.input.trim()) ? parsed.data.input.trim() : undefined);
  const flow = parsed.data.description ?? (parsed.data.input && !url ? parsed.data.input : undefined);

  // If we have a flow, generate against it (with URL as base for context).
  // If only a URL, generate a smoke test from the fetched page.
  const genInput = flow ?? url!;
  const isUrl = !flow && Boolean(url);
  const name = parsed.data.name ?? (flow ? flow.slice(0, 60) : `Smoke: ${url}`).slice(0, 60);

  const credentials = (parsed.data.username || parsed.data.password)
    ? { username: parsed.data.username, password: parsed.data.password }
    : undefined;

  let gen;
  try {
    gen = await generateTest({ input: genInput, isUrl, baseUrl: url, prd, needsAuth, credentials });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Insert via RLS (member must be admin/owner per the write policy).
  const { data: test, error } = await supabase
    .from("tests")
    .insert({
      project_id: project.id,
      org_id: project.org_id,
      name,
      suite: parsed.data.suite ?? null,
      description: flow ?? null,
      source_url: url ?? null,
      spec_path: specPathFor(name),
      spec_content: gen.specContent,
      plan: gen.plan as unknown as Json,
      source_files: sourceFiles ?? [],
      generated_model: gen.model,
      critical_path: criticalPath ?? false,
      // New UI specs start as drafts (Unverified) — "Verify drafts" runs them in a
      // real browser and promotes them to active (Verified ✓) or quarantined.
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    // 42501 = RLS violation (not an admin/owner of this org).
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, test, plan: gen.plan, used_live_context: gen.usedLiveContext });
}
