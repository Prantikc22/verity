import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { proposeTests } from "@/lib/llm/generate";
import { extractPageContext } from "@/lib/llm/page-context";
import { llmConfig } from "@/lib/llm/provider";
import { projectFromToken } from "@/lib/mcp-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Hard ceiling so a single proposal can't try to blow the whole monthly quota. */
const PROPOSAL_CEILING = 25;

const Body = z.object({
  scope: z.enum(["full", "diff"]).default("full"),
  url: z.string().url().optional(),
  prd: z.string().max(8000).optional(),
  changedFiles: z.array(z.string()).optional(),
  // HTML the MCP fetched on the user's machine (so localhost is reachable).
  pageHtml: z.string().max(800_000).optional(),
});

/**
 * Propose tests for the MCP server. "full" = cover the whole app/page; "diff" =
 * focus on the changed files the MCP collected from `git diff` on the user's
 * machine. Auth: project token.
 */
export async function POST(req: NextRequest) {
  const project = await projectFromToken(req);
  if (!project) return NextResponse.json({ error: "Invalid project token" }, { status: 401 });
  if (!llmConfig().configured) return NextResponse.json({ error: "LLM not configured" }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { scope, url, changedFiles } = parsed.data;

  // For a diff scope, fold the changed files into the PRD context so proposals
  // target what actually changed.
  let prd = parsed.data.prd;
  if (scope === "diff" && changedFiles?.length) {
    prd = `${prd ? prd + "\n\n" : ""}Focus on functionality affected by these changed files:\n- ${changedFiles.join("\n- ")}`;
  }

  // Propose as many as the plan still allows this month.
  const admin = createAdminClient();
  const { data: org } = await admin.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count: gensThisMonth }, { count: testsInProject }] = await Promise.all([
    admin.from("tests").select("id", { count: "exact", head: true }).eq("org_id", project.org_id).gte("created_at", monthStart.toISOString()),
    admin.from("tests").select("id", { count: "exact", head: true }).eq("project_id", project.id).neq("status", "archived"),
  ]);
  const headroom = Math.max(0, Math.min(plan.testGensPerMonth - (gensThisMonth ?? 0), plan.maxTests - (testsInProject ?? 0)));
  const max = Math.min(Math.max(headroom, 1), PROPOSAL_CEILING);

  // Prefer page context the MCP extracted from the user's machine (localhost is
  // unreachable from our server).
  const pageContext = parsed.data.pageHtml && url ? extractPageContext(parsed.data.pageHtml, url)?.summary : undefined;

  try {
    const { candidates, usedLiveContext } = await proposeTests({ url, prd, max, pageContext });
    return NextResponse.json({ ok: true, scope, candidates, used_live_context: usedLiveContext });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "propose failed" }, { status: 500 });
  }
}
