import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTest } from "@/lib/llm/generate";
import { extractPageContext } from "@/lib/llm/page-context";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";
import { projectFromToken } from "@/lib/mcp-auth";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  url: z.string().url().optional(),
  description: z.string().max(8000).optional(),
  prd: z.string().max(6000).optional(),
  name: z.string().max(120).optional(),
  needsAuth: z.boolean().optional(),
  sourceFiles: z.array(z.string()).optional(),
  criticalPath: z.boolean().optional(),
  // HTML the MCP fetched on the user's machine (so localhost is reachable).
  pageHtml: z.string().max(800_000).optional(),
}).refine((b) => b.url || b.description, { message: "Provide a url and/or a description." });

function specPathFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "flow";
  return `tests/${slug}-${randomUUID().slice(0, 8)}.spec.ts`;
}

/**
 * Generate + save a test from the MCP server. Returns the spec path + content so
 * the MCP can write the file into the user's repo. Marks origin='mcp'. Tier-capped.
 */
export async function POST(req: NextRequest) {
  const project = await projectFromToken(req);
  if (!project) return NextResponse.json({ error: "Invalid project token" }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM not configured" }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a url and/or a description." }, { status: 400 });

  const admin = createAdminClient();

  // Monthly generation cap per plan.
  const { data: org } = await admin.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count: used } = await admin
    .from("tests").select("id", { count: "exact", head: true })
    .eq("org_id", project.org_id).gte("created_at", monthStart.toISOString());
  if ((used ?? 0) >= plan.testGensPerMonth) {
    return NextResponse.json({ error: `Monthly generation cap reached on ${plan.name}.` }, { status: 402 });
  }

  const { url, description, prd, needsAuth, sourceFiles, criticalPath } = parsed.data;
  const flow = description;
  const genInput = flow ?? url!;
  const isUrl = !flow && Boolean(url);
  const name = parsed.data.name ?? (flow ? flow.slice(0, 60) : `Smoke: ${url}`).slice(0, 60);
  // The MCP fetched the page on the user's machine — use that context (our server
  // can't reach their localhost).
  const pageContext = parsed.data.pageHtml && url ? extractPageContext(parsed.data.pageHtml, url)?.summary : undefined;

  let gen;
  try {
    gen = await generateTest({ input: genInput, isUrl, baseUrl: url, prd, needsAuth, pageContext });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }

  const specPath = specPathFor(name);
  const { data: test, error } = await admin
    .from("tests")
    .insert({
      project_id: project.id,
      org_id: project.org_id,
      name,
      description: flow ?? null,
      source_url: url ?? null,
      spec_path: specPath,
      spec_content: gen.specContent,
      plan: gen.plan as unknown as Json,
      source_files: sourceFiles ?? [],
      generated_model: gen.model,
      critical_path: criticalPath ?? false,
      status: "draft",
      origin: "mcp",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    test_id: test.id,
    spec_path: specPath,
    spec_content: gen.specContent,
    plan: gen.plan,
    used_live_context: gen.usedLiveContext,
  });
}
