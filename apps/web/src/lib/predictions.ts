import { createClient } from "@/lib/supabase/server";
import {
  correlateDimensions,
  deployConfidence,
  type CorrelationSummary,
  type DeployConfidence,
  type DeploySignalRow,
} from "@qashift/verity-core";

/**
 * Read-side for the BETA predictions (3 & 4). Everything is computed from real
 * run history; when there isn't enough, the core helpers return null/unavailable
 * with a reason — we never fabricate a score or a correlation.
 */

/** Prediction 3 (BETA) — cross-dimension correlation over a project's deploys. */
export async function getCorrelation(projectId: string): Promise<CorrelationSummary> {
  const supabase = await createClient();
  // Read the per-deploy full-run signal stored ON the deploy — this is preserved
  // even after old test_runs are pruned, so correlation history never regresses.
  const { data: deploys } = await supabase
    .from("deploys")
    .select("full_total, full_failed, full_flaky, created_at")
    .eq("project_id", projectId)
    .not("full_total", "is", null)
    .order("created_at", { ascending: true });

  const rows: DeploySignalRow[] = (deploys ?? [])
    .filter((d) => (d.full_total ?? 0) > 0)
    .map((d) => ({
      regressionRisk: 0, // functional-only build: regression dimension folded into failureRate
      failureRate: d.full_total ? (d.full_failed ?? 0) / d.full_total : 0,
      flakeRate: d.full_total ? (d.full_flaky ?? 0) / d.full_total : 0,
    }));

  return correlateDimensions(rows);
}

/** Prediction 4 (BETA) — pre-merge deploy confidence for the latest deploy. */
export async function getDeployConfidence(projectId: string): Promise<{
  result: DeployConfidence;
  deployHistory: number;
}> {
  const supabase = await createClient();

  const { count: deployHistory } = await supabase
    .from("deploys")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data: latestFull } = await supabase
    .from("test_runs")
    .select("total, passed, failed, flaky")
    .eq("project_id", projectId)
    .eq("tier", "full")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fullPassRate = latestFull && latestFull.total > 0 ? latestFull.passed / latestFull.total : null;
  const meanFlakeRate = latestFull && latestFull.total > 0 ? latestFull.flaky / latestFull.total : null;

  // Critical coverage: share of active tests flagged critical_path with confidence.
  const { data: tests } = await supabase
    .from("tests")
    .select("critical_path, confidence")
    .eq("project_id", projectId)
    .eq("status", "active");
  const criticalCoverage = tests && tests.length
    ? tests.filter((t) => t.critical_path).length / tests.length
    : null;

  const result = deployConfidence({
    fullPassRate,
    meanFlakeRate,
    maxRegressionRisk: null, // not separately tracked in functional-only build
    criticalCoverage,
    deployHistory: deployHistory ?? 0,
  });

  return { result, deployHistory: deployHistory ?? 0 };
}
