import type { AttemptOutcome, FlakeCounters } from "./types";

export type Classification = "passed" | "failed" | "flaky" | "skipped";

/**
 * Classify one test's outcome from its per-attempt results (flake detection).
 * A test is rerun up to N times. If attempts disagree (some pass, some fail),
 * it is FLAKY — not a real failure. All-fail is a real failure; all-pass passes.
 * This is the line between "broken" and "flaky."
 */
export function classifyOutcome(outcome: AttemptOutcome): Classification {
  const a = outcome.attempts;
  if (a.length === 0) return "skipped";
  const passed = a.filter(Boolean).length;
  if (passed === a.length) return "passed";
  if (passed === 0) return "failed";
  return "flaky";
}

/** Flake rate in [0,1] from aggregate counters. 0 when no runs recorded. */
export function flakeRate(c: FlakeCounters): number {
  if (c.runsTotal <= 0) return 0;
  return Math.min(1, Math.max(0, c.flakyTotal / c.runsTotal));
}

/**
 * Whether a test should be quarantined: enough history AND a flake rate over
 * the threshold. Quarantined tests still run, but their failures don't block —
 * they're flagged as unreliable until stabilized.
 */
export function shouldQuarantine(
  c: FlakeCounters,
  opts: { minRuns?: number; threshold?: number } = {},
): boolean {
  const minRuns = opts.minRuns ?? 5;
  const threshold = opts.threshold ?? 0.2;
  if (c.runsTotal < minRuns) return false;
  return flakeRate(c) >= threshold;
}

/**
 * Disambiguate a single failure for a PR check (Prediction 2): given the test's
 * historical flake counters, decide whether this failure should be trusted as a
 * real blocker or flagged as likely flaky. Returns a human-readable verdict.
 */
export function disambiguateFailure(c: FlakeCounters): {
  likelyFlaky: boolean;
  flakeRate: number;
  verdict: string;
} {
  const rate = flakeRate(c);
  if (c.runsTotal < 5) {
    return {
      likelyFlaky: false,
      flakeRate: rate,
      verdict: "Not enough history to assess flakiness — treat as a real failure.",
    };
  }
  const likelyFlaky = rate >= 0.2;
  return {
    likelyFlaky,
    flakeRate: rate,
    verdict: likelyFlaky
      ? `Historically flaky (${Math.round(rate * 100)}% flake rate over ${c.runsTotal} runs) — verify before trusting as a blocker.`
      : `Stable historically (${Math.round(rate * 100)}% flake rate over ${c.runsTotal} runs) — likely a real failure.`,
  };
}
