import type { RegressionCounters } from "./types";

export interface RegressionFlag {
  filePath: string;
  /** Historical regression rate in [0,1]: regressions / changes. */
  rate: number;
  changesTotal: number;
  regressionsTotal: number;
  /** Whether the rate clears the project's risk threshold AND has enough history. */
  flagged: boolean;
}

/**
 * Prediction 1 — Regression-prone module flagging.
 * Compute the historical regression rate for each changed file and flag the
 * ones over the project threshold. Files with too little history are never
 * flagged (no fabricated risk from a single data point).
 */
export function flagRegressionProneFiles(
  changedFiles: string[],
  stats: RegressionCounters[],
  opts: { threshold?: number; minChanges?: number } = {},
): RegressionFlag[] {
  const threshold = opts.threshold ?? 0.25;
  const minChanges = opts.minChanges ?? 4;
  const byPath = new Map(stats.map((s) => [s.filePath, s]));

  const flags: RegressionFlag[] = [];
  for (const file of changedFiles) {
    const s = byPath.get(file);
    if (!s || s.changesTotal <= 0) continue; // no history → no claim
    const rate = s.regressionsTotal / s.changesTotal;
    flags.push({
      filePath: file,
      rate,
      changesTotal: s.changesTotal,
      regressionsTotal: s.regressionsTotal,
      flagged: s.changesTotal >= minChanges && rate >= threshold,
    });
  }
  // Highest risk first.
  return flags.sort((a, b) => b.rate - a.rate);
}
