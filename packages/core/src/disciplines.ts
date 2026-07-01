/**
 * Shared contracts for Verity's multi-discipline testing. Pure TS — no I/O, no
 * env, no SDKs — so the same types are reused by the core engine, the web
 * ingestion API, and the CI Action's per-engine result adapters.
 *
 * Design rule (do not break): the EXISTING UI/API ingest payload shape is a
 * strict subset of what is declared here. Every field added for a new
 * discipline is OPTIONAL, so existing posters (Playwright UI/API) keep working
 * unchanged and the ingestion API's external contract is preserved. New
 * disciplines simply populate the new optional fields.
 */

/** The five testing disciplines Verity supports. "ui" + "api" are the originals. */
export type Discipline = "ui" | "api" | "mobile" | "performance" | "security";

/**
 * The concrete tool ("engine") that produced a result. Used only internally for
 * adapter routing and telemetry — NEVER surfaced to the customer as a label
 * (the dashboard shows "Flow" vs "Contract", "Performance", "Security", etc.).
 */
export type Engine =
  | "playwright" // UI + API flow tests (existing)
  | "maestro" // mobile
  | "artillery" // performance load
  | "lighthouse" // performance / Core Web Vitals
  | "zap" // security DAST
  | "semgrep" // security SAST
  | "schemathesis"; // API contract

/**
 * Within API testing, which layer a result came from. Example-based flow tests
 * (existing Playwright-request) are "flow"; property-based contract checks
 * (Schemathesis) are "contract". The dashboard groups by endpoint then meaning
 * and shows ONLY these two human labels — never the engine name.
 */
export type ApiLayer = "flow" | "contract";

/** Severity scale shared by security findings (and any future severity-ranked output). */
export type Severity = "critical" | "high" | "medium" | "low" | "info";

/**
 * One security finding (DAST or SAST). Findings are NOT pass/fail tests — they
 * are surfaced in the dashboard's "Security" panel ranked by severity. The
 * `engine` is retained for internal grouping but is not shown to customers.
 */
export interface Finding {
  engine: Extract<Engine, "zap" | "semgrep">;
  /** Stable rule/alert identifier (Semgrep check_id, ZAP pluginid/alertRef). */
  ruleId: string;
  title: string;
  severity: Severity;
  /** Human-readable description / remediation guidance. */
  message: string;
  /** For SAST: source file path. For DAST: omitted. */
  filePath?: string | null;
  /** For SAST: 1-based line in `filePath`. */
  line?: number | null;
  /** For DAST: the affected URL/endpoint. */
  url?: string | null;
  /** CWE id (e.g. "CWE-79") when the tool provides one. */
  cwe?: string | null;
  /** Number of times this same finding occurred (instances collapsed). */
  count?: number;
}

/** Latency distribution + throughput for a performance run (or one scenario in it). */
export interface PerfMetrics {
  /** Total HTTP requests issued. */
  requests: number;
  /** Requests that errored or returned a non-2xx/3xx, depending on the engine. */
  errors: number;
  /** Error rate 0..1 (errors / requests). */
  errorRate: number;
  /** Latency percentiles in milliseconds. */
  p50: number | null;
  p95: number | null;
  p99: number | null;
  min?: number | null;
  max?: number | null;
  /** Requests per second (mean), when the engine reports it. */
  rps?: number | null;
}

/**
 * A performance report from one engine. `tier` mirrors the UI Quick-check/Full-
 * regression split: "fast" is the lightweight smoke check (few endpoints, short
 * duration, small VU count) labeled "Perf smoke check"; "full" is the complete
 * load test. Core Web Vitals (Lighthouse) ride along in `webVitals`.
 */
export interface PerfReport {
  engine: Extract<Engine, "artillery" | "lighthouse">;
  tier: "fast" | "full";
  /** Whole-run aggregate. */
  aggregate: PerfMetrics;
  /** Optional per-scenario / per-endpoint breakdown. */
  scenarios?: { name: string; metrics: PerfMetrics }[];
  /** Lighthouse Core Web Vitals (only when engine === "lighthouse"). */
  webVitals?: {
    /** Overall performance score 0..100. */
    performanceScore?: number | null;
    /** Largest Contentful Paint (ms). */
    lcp?: number | null;
    /** Cumulative Layout Shift (unitless). */
    cls?: number | null;
    /** Total Blocking Time (ms). */
    tbt?: number | null;
    /** First Contentful Paint (ms). */
    fcp?: number | null;
  };
}

/**
 * One unified test result row. This is a SUPERSET of the existing UI/API
 * ingest result — `spec_path` + `attempts` carry exactly the same meaning as
 * today, and everything else is optional. Mobile (Maestro) and API-contract
 * (Schemathesis) results map cleanly onto pass/fail `attempts`; performance and
 * security do NOT use this shape (they use PerfReport / Finding[] instead).
 */
export interface UnifiedResult {
  /** Spec/flow path, e.g. "tests/verity/mobile/login.yaml" or a Schemathesis op id. */
  spec_path: string;
  /** Human-readable name/title. */
  name?: string;
  /** Per-attempt pass/fail; length = attempts used (flake reruns). Same as today. */
  attempts: boolean[];
  duration_ms?: number;
  error_message?: string | null;
  failing_selector?: string | null;

  // ---- additive discipline metadata (all optional) ----
  /** Which discipline produced this row. Defaults to "ui" when absent. */
  discipline?: Discipline;
  /** Which engine produced it (internal). */
  engine?: Engine;
  /** API layer, for API results only: "flow" (Playwright) or "contract" (Schemathesis). */
  layer?: ApiLayer;
  /** Endpoint this result concerns, e.g. "POST /users" — used to group API results. */
  endpoint?: string | null;
  /**
   * A normalized "meaning" of the result used for dedup/grouping — e.g.
   * "missing-field-returns-500". When a flow result and a contract result share
   * the same endpoint + meaning, they collapse into one entry tagged as found by
   * both layers. Omit when no cross-layer collapse is intended.
   */
  meaning?: string | null;
}

/* ------------------------------------------------------------------ *
 * Dashboard presentation contracts for API results (Flow vs Contract) *
 * ------------------------------------------------------------------ */

/** One API entry after grouping by endpoint+meaning and collapsing duplicates. */
export interface GroupedApiEntry {
  /** Short, customer-facing description. Prefixed with the layer at render time. */
  description: string;
  /** Which layers surfaced this — both when a flow + contract result collapsed. */
  foundBy: ApiLayer[];
  status: "passed" | "failed" | "flaky";
  meaning?: string | null;
  error_message?: string | null;
}

/** API results grouped by endpoint, each endpoint holding its collapsed entries. */
export interface GroupedApiEndpoint {
  endpoint: string;
  entries: GroupedApiEntry[];
}
