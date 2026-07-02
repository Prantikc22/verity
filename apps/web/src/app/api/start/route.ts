import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateTest } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { getUser, getPrimaryOrg, ensureOrgForCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ input: z.string().min(3).max(4000) });

function specPathFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "flow";
  return `tests/${slug}.spec.ts`;
}

/**
 * "Try it" for signed-in users: generate a test from a URL/description AND save
 * it into the user's project (auto-provisioning an org + a first project if
 * needed). Powers the hero "create a free account → get your first test saved".
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM not configured." }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide { input }." }, { status: 400 });
  const { input } = parsed.data;
  const isUrl = /^https?:\/\//i.test(input.trim());

  // Ensure an org + a first project exist.
  await ensureOrgForCurrentUser();
  const org = await getPrimaryOrg();
  if (!org) return NextResponse.json({ error: "No organization found." }, { status: 400 });

  const admin = createAdminClient();
  let { data: proj } = await admin
    .from("projects").select("id").eq("org_id", org.org.id)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!proj) {
    const ins = await admin.from("projects").insert({ org_id: org.org.id, name: "My app" }).select("id").single();
    if (ins.error || !ins.data) return NextResponse.json({ error: "Could not create a project." }, { status: 500 });
    proj = ins.data;
  }

  let gen;
  try {
    gen = await generateTest({ input, isUrl, baseUrl: isUrl ? input.trim() : undefined });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }

  const name = (isUrl ? `Smoke: ${input.trim()}` : input.trim()).slice(0, 60);
  const specPath = specPathFor(name);
  const { data: test, error } = await admin
    .from("tests")
    .insert({
      project_id: proj.id,
      org_id: org.org.id,
      name,
      description: isUrl ? null : input.trim(),
      source_url: isUrl ? input.trim() : null,
      spec_path: specPath,
      spec_content: gen.specContent,
      plan: gen.plan as unknown as Json,
      source_files: [],
      generated_model: gen.model,
      critical_path: false,
      status: "draft",
      origin: "web",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, projectId: proj.id, testId: test.id });
}
