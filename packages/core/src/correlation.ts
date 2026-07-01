/**
 * Prediction 3 (BETA) — Cross-dimension risk correlation.
 * Deploy-level summary correlating patterns across signals once enough history
 * exists. In this build only the functional dimension is collected, so the
 * summary correlates the functional sub-signals (regression risk, failure rate,
 * flake rate) over recent deploys. It is explicitly Beta and refuses to show
 * anything until the minimum data threshold is met.
 */

export const MIN_DEPLOYS_FOR_CORRELATION = 20;

export interface DeploySignalRow {
  /** Max regression-prone rate among changed files, [0,1]. */
  regressionRisk: number;
  /** Real-failure rate for the deploy's full run, [0,1]. */
  failureRate: number;
  /** Mean flake rate across executed tests, [0,1]. */
  flakeRate: number;
}

/** Pearson correlation coefficient, or null when undefined (zero variance / n<3). */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export interface CorrelationSummary {
  available: boolean;
  reason?: string;
  /** Correlation between flagged regression risk and actual failures. */
  regressionVsFailure: number | null;
  /** Correlation between flake rate and actual failures. */
  flakeVsFailure: number | null;
  deploys: number;
}

export function correlateDimensions(rows: DeploySignalRow[]): CorrelationSummary {
  if (rows.length < MIN_DEPLOYS_FOR_CORRELATION) {
    return {
      available: false,
      reason: `Not enough data yet (${rows.length}/${MIN_DEPLOYS_FOR_CORRELATION} deploys). Correlation appears once history accumulates.`,
      regressionVsFailure: null,
      flakeVsFailure: null,
      deploys: rows.length,
    };
  }
  return {
    available: true,
    regressionVsFailure: pearson(
      rows.map((r) => r.regressionRisk),
      rows.map((r) => r.failureRate),
    ),
    flakeVsFailure: pearson(
      rows.map((r) => r.flakeRate),
      rows.map((r) => r.failureRate),
    ),
    deploys: rows.length,
  };
}
