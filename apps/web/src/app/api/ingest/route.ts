import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordRun, isFirstCiRun, type IngestPayload } from "@/lib/ingest";
import { postRunResults, postDisciplineResults } from "@/lib/github/post";
import { planFor } from "@/lib/plans";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const maxDuration = 60;

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: "Missing ingest token (Authorization: Bearer ...)" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Invalid ingest token" }, { status: 401 });
  }

  let payload: IngestPayload;
  try {
    payload = (await req.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Performance/security runs post metrics/findings instead of pass/fail
  // results[], so a non-empty results[] is only required when neither is present.
  const hasFindings = Array.isArray(payload.findings) && payload.findings.length > 0;
  const hasPerf = payload.perf != null;
  if (
    !payload.commit_sha ||
    !payload.branch ||
    !payload.tier ||
    !Array.isArray(payload.results) ||
    (payload.results.length === 0 && !hasFindings && !hasPerf)
  ) {
    return NextResponse.json(
      { error: "Body must include tier ('fast'|'full'), commit_sha, branch, and results[] (or findings[]/perf for security/performance)." },
      { status: 400 },
    );
  }

  // Enum-shaped fields must be valid, or the DB insert fails with a cryptic error.
  const VALID_TIERS = ["fast", "full"];
  const VALID_TRIGGERS = ["pr", "merge", "schedule", "predeploy", "manual"];
  if (!VALID_TIERS.includes(payload.tier)) {
    return NextResponse.json({ error: `tier must be one of ${VALID_TIERS.join(", ")}.` }, { status: 400 });
  }
  if (!payload.trigger || !VALID_TRIGGERS.includes(payload.trigger)) {
    return NextResponse.json({ error: `trigger must be one of ${VALID_TRIGGERS.join(", ")}.` }, { status: 400 });
  }
  // Each result reports per-attempt booleans (pass/fail per rerun); it's required.
  const badResult = payload.results.find(
    (r) => !r || typeof r.spec_path !== "string" || !Array.isArray(r.attempts) || r.attempts.length === 0,
  );
  if (badResult) {
    return NextResponse.json(
      { error: "Each result must include a spec_path (string) and a non-empty attempts[] (boolean per rerun)." },
      { status: 400 },
    );
  }

  // The full tier may never be diff-shortcut. A 'full' run must carry results
  // for the whole suite, so we reject a full run that also sends changed_files
  // as a selection hint — selection is a fast-tier concept only.
  if (payload.tier === "full" && payload.suite_total && payload.results.length < payload.suite_total) {
    return NextResponse.json(
      { error: "Full regression must run the entire suite — received a subset. Use tier:'fast' for diff-aware runs." },
      { status: 400 },
    );
  }

  // Effective plan from the org.
  const { data: org } = await admin.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);

  const first = await isFirstCiRun(project.id);

  let result;
  try {
    result = await recordRun(project, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // PR bot (Check Run + comment) is Starter+. Merge-blocking is Growth+ AND
  // only ever applies to the Full-regression tier — never to a Quick check.
  let checkUrl: string | null = null;
  if (plan.prGating) {
    try {
      // Performance/security post a SEPARATE, additive comment + Check Run (own
      // marker) so the existing UI/API comment format is never altered. Pass/fail
      // disciplines (ui/api/mobile) use the existing path unchanged.
      if (result.discipline === "performance" || result.discipline === "security") {
        checkUrl = await postDisciplineResults(project, result, payload.commit_sha, payload.pr_number ?? null, {
          gatingAllowed: plan.prGating,
        });
      } else {
        checkUrl = await postRunResults(project, result, payload.commit_sha, payload.pr_number ?? null, {
          gatingAllowed: plan.prGating,
          mergeBlocking: plan.mergeBlocking,
        });
      }
    } catch (err) {
      console.error("[ingest] github post failed:", err);
    }
  }

  if (first) {
    await captureServer(project.org_id, FUNNEL_EVENTS.firstCiRun, {
      project_id: project.id,
      tier: payload.tier,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const blocked = result.tier === "full" && result.failed > 0 && plan.mergeBlocking;

  // Perf smoke checks must never read as a full load test in the label.
  const tierLabel =
    result.discipline === "performance"
      ? result.tier === "fast"
        ? "Perf smoke check"
        : "Full load test"
      : result.tier === "fast"
        ? "Quick check"
        : "Full regression";

  return NextResponse.json({
    ok: true,
    tier: result.tier,
    discipline: result.discipline,
    tier_label: tierLabel,
    blocked,
    run_id: result.runId,
    commit: payload.commit_sha,
    branch: payload.branch,
    summary: {
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      flaky: result.flaky,
      skipped: result.skipped,
    },
    findings_summary: {
      total: result.findings.length,
      critical: result.findings.filter((f) => f.severity === "critical").length,
      high: result.findings.filter((f) => f.severity === "high").length,
      medium: result.findings.filter((f) => f.severity === "medium").length,
      low: result.findings.filter((f) => f.severity === "low").length,
    },
    perf: result.perf
      ? { engine: result.perf.engine, tier: result.perf.tier, aggregate: result.perf.aggregate }
      : null,
    regression_flags: result.regressionFlags.filter((f) => f.flagged),
    check_run: checkUrl,
    run_url: `${appUrl.replace(/\/$/, "")}/dashboard/projects/${project.id}/runs/${result.runId}`,
  });
}
