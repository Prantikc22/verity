/** Shared, pure-TS contracts for the Verity engine. No I/O, no env, no SDKs. */

export type RunTier = "fast" | "full";
export type ResultStatus = "passed" | "failed" | "flaky" | "skipped" | "healed";

/** A test's static mapping to the source files it exercises (diff-aware selection). */
export interface TestMapping {
  /** Spec path, e.g. "tests/checkout.spec.ts". */
  specPath: string;
  /** Source files this spec exercises (from import analysis or a mapping file). */
  sourceFiles: string[];
}

/** A single test's outcome across one or more attempts within a run. */
export interface AttemptOutcome {
  /** Per-attempt pass/fail; length === attempts used. */
  attempts: boolean[];
}

/** Aggregate flake counters persisted per test. */
export interface FlakeCounters {
  runsTotal: number;
  flakyTotal: number;
}

/** Per-file regression counters persisted per project. */
export interface RegressionCounters {
  filePath: string;
  changesTotal: number;
  regressionsTotal: number;
}
