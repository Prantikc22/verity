import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { healSelector } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  oldSelector: z.string().min(1),
  domContext: z.string().min(1).max(20000),
  intent: z.string().max(500).optional(),
  testId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
});

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Self-healing locator resolution. Authed by the project ingest token (this runs
 * inside CI during a run). Proposes a corrected selector and logs a healing
 * event with status 'suggested'. It NEVER writes the fix back into source — the
 * suggestion is surfaced to the user as a diff for review.
 */
export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: "Missing ingest token" }, { status: 401 });

  if (!llmConfig().configured) {
    return NextResponse.json({ error: "LLM is not configured (set LLM_API_KEY)." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, org_id")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Invalid ingest token" }, { status: 401 });

  // Plan gate — self-healing is a paid feature. Reject BEFORE any LLM call so
  // free-tier CI can't burn our token budget. Generated tests self-heal from
  // Self-Serve Pro up (see lib/plans.ts).
  const { data: org } = await admin.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  if (!planFor(org?.plan).selfHealing) {
    return NextResponse.json(
      { error: "Self-healing is a paid feature — it's included from Self-Serve Pro. Upgrade to enable locator healing in CI.", healed: false, upgrade: true },
      { status: 402 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide { oldSelector, domContext, intent? }." }, { status: 400 });
  }
  const { oldSelector, domContext, intent, testId, runId } = parsed.data;

  let suggestion;
  try {
    suggestion = await healSelector({ oldSelector, domContext, intent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "heal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Low confidence or empty → no credible fix; record nothing, tell the runner.
  if (!suggestion.selector || suggestion.confidence < 0.3) {
    return NextResponse.json({
      ok: true,
      healed: false,
      reason: "No confident replacement found in the provided DOM.",
      confidence: suggestion.confidence,
    });
  }

  const { data: event } = await admin
    .from("healing_events")
    .insert({
      project_id: project.id,
      test_id: testId ?? null,
      run_id: runId ?? null,
      old_selector: oldSelector,
      new_selector: suggestion.selector,
      dom_context: domContext.slice(0, 8000),
      confidence: suggestion.confidence,
      status: "suggested", // never auto-applied
    })
    .select("id")
    .single();

  return NextResponse.json({
    ok: true,
    healed: true,
    suggestion: {
      selector: suggestion.selector,
      confidence: suggestion.confidence,
      rationale: suggestion.rationale,
    },
    healing_event_id: event?.id ?? null,
    note: "Suggested only — review and apply the diff in the dashboard. Not written to source.",
  });
}
