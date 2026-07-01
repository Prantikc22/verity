/**
 * Per-test confidence scoring and the pre-merge deploy confidence composite.
 * Everything here is null-honest: when the inputs don't exist yet, the score is
 * null, never a fabricated number.
 */

export interface TestConfidenceInput {
  /** Does this test exercise a route/flow marked critical? */
  criticalPath: boolean;
  /** Total recorded runs for this test. */
  runsTotal: number;
  /** Flake rate in [0,1]. */
  flakeRate: number;
  /** Number of assertions in the spec (proxy for how much it actually checks). */
  assertionCount: number;
}

/**
 * Confidence that a green result on this test is meaningful (not "technically
 * green but checks nothing"). Returns null until there's enough run history.
 */
export function testConfidence(input: TestConfidenceInput): number | null {
  if (input.runsTotal < 3) return null; // not enough signal yet
  const assertionScore = Math.min(1, input.assertionCount / 5); // 5+ assertions → full
  const stability = 1 - Math.min(1, input.flakeRate);
  const criticality = input.criticalPath ? 1 : 0.6;
  const score = 0.45 * assertionScore + 0.35 * stability + 0.2 * criticality;
  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

export interface DeployConfidenceInput {
  /** Full-regression pass rate in [0,1] for this deploy, or null if no full run. */
  fullPassRate: number | null;
  /** Mean flake rate across executed tests in [0,1], or null. */
  meanFlakeRate: number | null;
  /** Max regression-prone rate among changed files in [0,1], or null. */
  maxRegressionRisk: number | null;
  /** Share of executed tests that meaningfully cover critical paths in [0,1], or null. */
  criticalCoverage: number | null;
  /** How many prior deploys of history exist (gates whether we score at all). */
  deployHistory: number;
}

export interface DeployConfidence {
  /** 0..100 composite, or null when not computable / insufficient history. */
  score: number | null;
  breakdown: Record<string, number | null>;
  /** Why the score is null, when it is. */
  reason?: string;
}

/** Minimum deploy history before the Beta composite is shown at all. */
export const MIN_DEPLOY_HISTORY = 20;

/**
 * Prediction 4 (BETA) — Pre-merge deploy confidence.
 * A single decomposed 0..100 score. Returns null (with a reason) until enough
 * deploy history exists to calibrate it — it must never look authoritative
 * before Predictions 1–3 have run long enough.
 */
export function deployConfidence(input: DeployConfidenceInput): DeployConfidence {
  const breakdown: Record<string, number | null> = {
    full_pass_rate: input.fullPassRate,
    stability: input.meanFlakeRate == null ? null : 1 - input.meanFlakeRate,
    regression_safety: input.maxRegressionRisk == null ? null : 1 - input.maxRegressionRisk,
    critical_coverage: input.criticalCoverage,
  };

  if (input.deployHistory < MIN_DEPLOY_HISTORY) {
    return {
      score: null,
      breakdown,
      reason: `Not enough deploy history yet (${input.deployHistory}/${MIN_DEPLOY_HISTORY}). Beta score appears once calibration data exists.`,
    };
  }

  const dims = [
    { v: breakdown.full_pass_rate, w: 0.4 },
    { v: breakdown.stability, w: 0.25 },
    { v: breakdown.regression_safety, w: 0.2 },
    { v: breakdown.critical_coverage, w: 0.15 },
  ].filter((d) => d.v != null) as { v: number; w: number }[];

  if (dims.length === 0) {
    return { score: null, breakdown, reason: "No measurable dimensions for this deploy yet." };
  }

  const totalW = dims.reduce((s, d) => s + d.w, 0);
  const weighted = dims.reduce((s, d) => s + d.v * d.w, 0) / totalW;
  return { score: Math.round(weighted * 100), breakdown };
}
