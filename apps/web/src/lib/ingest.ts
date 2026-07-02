import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyOutcome,
  flagRegressionProneFiles,
  collapseFindings,
  sortFindings,
  type Classification,
  type RegressionCounters,
  type Discipline,
  type Engine,
  type ApiLayer,
  type Finding,
  type PerfReport,
} from "@qashift/verity-core";
import type { Enums, Tables, TablesInsert } from "@/lib/supabase/database.types";

/** One test's result as reported by the runner (per-attempt pass/fail). */
export interface IngestResultInput {
  spec_path: string;
  name?: string;
  /** Per-attempt outcomes; length = attempts used (flake reruns). */
  attempts: boolean[];
  duration_ms?: number;
  error_message?: string | null;
  /** Selector that failed, captured for self-healing. */
  failing_selector?: string | null;
  // ---- additive discipline metadata (all optional; absent ⇒ legacy UI/API) ----
  /** Which discipline produced this row. Defaults to the payload discipline / "ui". */
  discipline?: Discipline;
  /** Internal engine that produced it (playwright-visual, llm-eval, schemathesis, …). */
  engine?: Engine;
  /** API layer: "flow" (Playwright) or "contract" (Schemathesis). */
  layer?: ApiLayer;
  /** Endpoint this result concerns, e.g. "POST /users" (API grouping). */
  endpoint?: string | null;
  /** Normalized cause for cross-layer dedup, e.g. "missing-field-returns-5xx". */
  meaning?: string | null;
}

export interface IngestPayload {
  tier: Enums<"run_tier">;
  trigger: Enums<"run_trigger">;
  commit_sha: string;
  branch: string;
  pr_number?: number | null;
  /** Files changed in this PR/commit (diff-aware selection + regression stats). */
  changed_files?: string[];
  /** Total tests in the suite (fast tier reports how many of these were selected). */
  suite_total?: number;
  results: IngestResultInput[];
  // ---- additive: new disciplines feed in here without changing the contract ----
  /** Run-level discipline; defaults to "ui". Controls comment format + rollups. */
  discipline?: Discipline;
  /** Security findings (DAST/SAST). Surfaced as "Security" issues, not pass/fail. */
  findings?: Finding[];
  /** Performance report (Artillery/Lighthouse). Surfaced in the Performance panel. */
  perf?: PerfReport;
}

export interface RegressionFlagOut {
  filePath: string;
  rate: number;
  flagged: boolean;
}

export interface IngestResult {
  runId: string;
  deployId: string;
  tier: Enums<"run_tier">;
  discipline: Discipline;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  healed: number;
  selectedCount: number | null;
  /** Real failures only (flaky excluded) — what actually blocks. */
  realFailures: { spec_path: string; error_message: string | null; flakeRate: number; runsTotal: number }[];
  regressionFlags: RegressionFlagOut[];
  /** Security findings recorded this run (ranked, deduped). Empty unless discipline=security. */
  findings: Finding[];
  /** Performance report recorded this run. Null unless discipline=performance. */
  perf: PerfReport | null;
}

const statusEnum = (c: Classification): Enums<"result_status"> => c;

/**
 * Record one CI run (Path B). Persists the run + per-test results with flake
 * classification, rolls up flake_stats and regression_stats (Prediction 1/2
 * inputs), links a deploy, and returns a summary for the PR comment.
 */
export async function recordRun(
  project: Tables<"projects">,
  payload: IngestPayload,
): Promise<IngestResult> {
  const admin = createAdminClient();
  const discipline: Discipline = payload.discipline ?? "ui";
  // Disciplines whose results are genuine pass/fail tests (feed flake/regression
  // math + the existing PR comment). Performance/security do NOT — they post
  // metrics/findings instead and must never pollute flake or regression stats.
  const isPassFail = discipline === "ui" || discipline === "api" || discipline === "visual" || discipline === "agent";

  // 1. Upsert a deploy for this commit (the unit Predictions 3/4 summarize over).
  const { data: existingDeploy } = await admin
    .from("deploys")
    .select("id")
    .eq("project_id", project.id)
    .eq("commit_sha", payload.commit_sha)
    .maybeSingle();
  let deployId = existingDeploy?.id;
  if (!deployId) {
    const { data: dep, error: depErr } = await admin
      .from("deploys")
      .insert({
        project_id: project.id,
        org_id: project.org_id,
        commit_sha: payload.commit_sha,
        branch: payload.branch,
        pr_number: payload.pr_number ?? null,
      })
      .select("id")
      .single();
    if (depErr || !dep) throw new Error(`Failed to record deploy: ${depErr?.message ?? "unknown error"}`);
    deployId = dep.id;
  }

  // 2. Create the run row.
  const { data: run, error: runErr } = await admin
    .from("test_runs")
    .insert({
      project_id: project.id,
      org_id: project.org_id,
      deploy_id: deployId,
      tier: payload.tier,
      trigger: payload.trigger,
      discipline,
      commit_sha: payload.commit_sha,
      branch: payload.branch,
      pr_number: payload.pr_number ?? null,
      status: "running",
      total: payload.results.length,
      selected_count: payload.tier === "fast" ? payload.results.length : null,
    })
    .select("*")
    .single();
  if (runErr || !run) throw new Error(`Failed to record run: ${runErr?.message ?? "unknown error"}`);
  const runId = run.id;

  // Map spec_path → test row (for test_id linkage + flake stats).
  const { data: tests } = await admin
    .from("tests")
    .select("id, spec_path")
    .eq("project_id", project.id);
  const testByPath = new Map((tests ?? []).map((t) => [t.spec_path, t.id]));

  let passed = 0, failed = 0, flaky = 0, skipped = 0;
  const healed = 0;
  const realFailures: IngestResult["realFailures"] = [];

  // 3. Per-test results + flake-stat rollup.
  for (const r of payload.results) {
    const cls = classifyOutcome({ attempts: r.attempts });
    if (cls === "passed") passed++;
    else if (cls === "failed") failed++;
    else if (cls === "flaky") flaky++;
    else skipped++;

    const testId = testByPath.get(r.spec_path) ?? null;

    const row: TablesInsert<"test_results"> = {
      run_id: runId,
      test_id: testId,
      project_id: project.id,
      status: statusEnum(cls),
      attempts: r.attempts.length,
      duration_ms: r.duration_ms ?? null,
      error_message: r.error_message ?? null,
      failing_selector: r.failing_selector ?? null,
      name: r.name ?? null,
      spec_path: r.spec_path,
      discipline: r.discipline ?? discipline,
      engine: r.engine ?? null,
      layer: r.layer ?? null,
      endpoint: r.endpoint ?? null,
      meaning: r.meaning ?? null,
    };
    await admin.from("test_results").insert(row);

    // Roll up flake counters for this test.
    let flakeRate = 0, runsTotal = 0;
    if (testId) {
      const { data: fs } = await admin
        .from("flake_stats")
        .select("runs_total, flaky_total")
        .eq("test_id", testId)
        .maybeSingle();
      const runsNext = (fs?.runs_total ?? 0) + 1;
      const flakyNext = (fs?.flaky_total ?? 0) + (cls === "flaky" ? 1 : 0);
      await admin.from("flake_stats").upsert({
        test_id: testId,
        project_id: project.id,
        runs_total: runsNext,
        flaky_total: flakyNext,
        last_flaky_at: cls === "flaky" ? new Date().toISOString() : (fs ? undefined : null),
        updated_at: new Date().toISOString(),
      });
      runsTotal = runsNext;
      flakeRate = runsNext > 0 ? flakyNext / runsNext : 0;
    }

    if (cls === "failed") {
      realFailures.push({
        spec_path: r.spec_path,
        error_message: r.error_message ?? null,
        flakeRate,
        runsTotal,
      });
    }
  }

  const hadRealFailure = failed > 0;

  // 4. Regression-stat attribution: every changed file gets a +1 change; if the
  //    run had a real failure, the changed files also get a +1 regression.
  //    Only pass/fail disciplines (ui/api/visual/agent) contribute — perf/security
  //    runs must never affect regression-prone-file math.
  for (const file of isPassFail ? payload.changed_files ?? [] : []) {
    const { data: rs } = await admin
      .from("regression_stats")
      .select("changes_total, regressions_total")
      .eq("project_id", project.id)
      .eq("file_path", file)
      .maybeSingle();
    await admin.from("regression_stats").upsert(
      {
        project_id: project.id,
        file_path: file,
        changes_total: (rs?.changes_total ?? 0) + 1,
        regressions_total: (rs?.regressions_total ?? 0) + (hadRealFailure ? 1 : 0),
        last_regression_at: hadRealFailure ? new Date().toISOString() : (rs ? undefined : null),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,file_path" },
    );
  }

  // 5. Prediction 1 — regression-prone flags for the changed files (post-rollup).
  let regressionFlags: RegressionFlagOut[] = [];
  if (isPassFail && (payload.changed_files ?? []).length > 0) {
    const { data: statRows } = await admin
      .from("regression_stats")
      .select("file_path, changes_total, regressions_total")
      .eq("project_id", project.id)
      .in("file_path", payload.changed_files!);
    const counters: RegressionCounters[] = (statRows ?? []).map((s) => ({
      filePath: s.file_path,
      changesTotal: s.changes_total,
      regressionsTotal: s.regressions_total,
    }));
    regressionFlags = flagRegressionProneFiles(payload.changed_files!, counters, {
      threshold: Number(project.regression_threshold),
    }).map((f) => ({ filePath: f.filePath, rate: f.rate, flagged: f.flagged }));
  }

  // 5b. Persist security findings (discipline=security) — deduped + ranked.
  //     These are NOT pass/fail tests; the dashboard shows them in the Security
  //     panel and the PR comment renders a separate "Security" section.
  let findings: Finding[] = [];
  if (payload.findings && payload.findings.length > 0) {
    findings = sortFindings(collapseFindings(payload.findings));
    const rows: TablesInsert<"security_findings">[] = findings.map((f) => ({
      run_id: runId,
      project_id: project.id,
      org_id: project.org_id,
      engine: f.engine,
      rule_id: f.ruleId,
      title: f.title,
      severity: f.severity,
      message: f.message ?? null,
      file_path: f.filePath ?? null,
      line: f.line ?? null,
      url: f.url ?? null,
      cwe: f.cwe ?? null,
      count: f.count ?? 1,
    }));
    if (rows.length) await admin.from("security_findings").insert(rows);
  }

  // 5c. Persist the performance report (discipline=performance).
  const perf: PerfReport | null = payload.perf ?? null;
  if (perf) {
    await admin.from("perf_reports").insert({
      run_id: runId,
      project_id: project.id,
      org_id: project.org_id,
      engine: perf.engine,
      tier: perf.tier,
      aggregate: perf.aggregate as unknown as TablesInsert<"perf_reports">["aggregate"],
      scenarios: (perf.scenarios ?? null) as unknown as TablesInsert<"perf_reports">["scenarios"],
      web_vitals: (perf.webVitals ?? null) as unknown as TablesInsert<"perf_reports">["web_vitals"],
    });
  }

  // 6. Finalize the run row.
  const duration = payload.results.reduce((a, r) => a + (r.duration_ms ?? 0), 0);
  await admin
    .from("test_runs")
    .update({
      status: "completed",
      passed,
      failed,
      flaky,
      skipped,
      healed,
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  // Persist this deploy's full-run signal ON the deploy (never pruned) so the
  // correlation/confidence predictions survive run-history retention.
  if (isPassFail && payload.tier === "full") {
    await admin.from("deploys").update({ full_total: passed + failed + flaky + skipped, full_failed: failed, full_flaky: flaky }).eq("id", deployId!);
  }

  // Keep detailed history bounded (aggregate stats are preserved).
  try { await pruneOldRuns(project.id); } catch (e) { console.error("[ingest] prune failed:", e); }

  return {
    runId,
    deployId: deployId!,
    tier: payload.tier,
    discipline,
    total: payload.results.length,
    passed,
    failed,
    flaky,
    skipped,
    healed,
    selectedCount: payload.tier === "fast" ? payload.results.length : null,
    realFailures,
    regressionFlags,
    findings,
    perf,
  };
}

/** Detailed run history retained per project. Aggregate stats (flake/regression)
 *  are rollups and are NEVER pruned — so trends + predictions survive. */
export const RETAINED_RUNS_PER_PROJECT = 30;

/**
 * Prune detailed history so the DB stays bounded: keep only the most recent
 * RETAINED_RUNS_PER_PROJECT runs per project and hard-delete the rest (and their
 * results/findings/perf/heal events). The aggregate stat tables are untouched.
 */
export async function pruneOldRuns(projectId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: old } = await admin
    .from("test_runs")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(RETAINED_RUNS_PER_PROJECT, RETAINED_RUNS_PER_PROJECT + 999);
  const ids = (old ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;
  // Children first (in case any FK lacks ON DELETE CASCADE), then the runs.
  await admin.from("test_results").delete().in("run_id", ids);
  await admin.from("healing_events").delete().in("run_id", ids);
  await admin.from("security_findings").delete().in("run_id", ids);
  await admin.from("perf_reports").delete().in("run_id", ids);
  await admin.from("test_runs").delete().in("id", ids);
  return ids.length;
}

/** Whether this project has any prior CI run (for the first_ci_run funnel event). */
export async function isFirstCiRun(projectId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("test_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return (count ?? 0) === 0;
}
