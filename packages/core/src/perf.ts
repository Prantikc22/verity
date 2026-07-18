/**
 * k6 performance profiles + script assembly. Pure strings/data — no I/O.
 *
 * Design: the AI writes ONLY the scenario body (the requests, built from the
 * OpenAPI spec). The load *shape* (executors, stages, thresholds) is
 * DETERMINISTIC and lives here, so latency thresholds and ramp stages are
 * always valid k6 — never hallucinated. One generated script runs every
 * profile; pick with `k6 run -e PROFILE=<name>`. Knobs come from env
 * (`VUS`, `DURATION`, `BASE_URL`) so the committed script is configurable
 * without regeneration — the same ethos as a hand-written k6 suite.
 */
import type { PerfProfile } from "./disciplines";

export interface PerfProfileMeta {
  profile: PerfProfile;
  /** Customer-facing label (never a tool name). */
  label: string;
  /** One-line "what it answers". */
  question: string;
  /** Which honesty tier it belongs to: smoke is the cheap PR check. */
  tier: "fast" | "full";
}

/** Ordered for display: cheapest/most-common first. */
export const PERF_PROFILES: PerfProfileMeta[] = [
  { profile: "smoke", label: "Smoke", question: "Does it work under trivial load? (runs every PR)", tier: "fast" },
  { profile: "load", label: "Load", question: "Does it hold up at normal peak traffic?", tier: "full" },
  { profile: "stress", label: "Stress", question: "Where does it start to degrade past peak?", tier: "full" },
  { profile: "spike", label: "Spike", question: "Does it survive a sudden flash crowd?", tier: "full" },
  { profile: "soak", label: "Soak", question: "Does it leak or drift over a long run?", tier: "full" },
  { profile: "breakpoint", label: "Breakpoint", question: "What is the exact breaking point?", tier: "full" },
];

export const PERF_PROFILE_NAMES = PERF_PROFILES.map((p) => p.profile);
export function isPerfProfile(v: string): v is PerfProfile {
  return (PERF_PROFILE_NAMES as string[]).includes(v);
}

/** Defaults baked into the script (overridable at run time via env). */
export interface K6Defaults {
  /** Peak concurrency knob (VUS). */
  vus?: number;
  /** Steady-phase length for the load profile, e.g. "1m". */
  duration?: string;
  /** p95 latency threshold (ms) — the run is marked failing above this. */
  p95Ms?: number;
  /** Error-rate threshold (0..1). */
  errorRate?: number;
}

/**
 * Assemble a complete, runnable, self-contained k6 script. `scenarioBody` is the
 * inside of the default scenario function (the AI-authored requests). If it's
 * empty we fall back to a single GET against BASE_URL so the script always runs.
 */
export function buildK6Script(opts: { baseUrl: string; scenarioBody?: string; defaults?: K6Defaults }): string {
  const vus = opts.defaults?.vus ?? 10;
  const duration = opts.defaults?.duration ?? "1m";
  const p95 = opts.defaults?.p95Ms ?? 800;
  const errRate = opts.defaults?.errorRate ?? 0.01;
  const body = (opts.scenarioBody ?? "").trim() || defaultScenarioBody();

  return `// Verity performance suite (k6). Generated — commit and own it.
// Run any profile:  k6 run -e PROFILE=load -e BASE_URL=${opts.baseUrl} verity.k6.js
// Profiles: ${PERF_PROFILE_NAMES.join(" | ")}  (default: smoke)
// Knobs (env): VUS=<peak concurrency>  DURATION=<steady phase e.g. 2m>  BASE_URL=<target>
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || ${JSON.stringify(opts.baseUrl)};
const VUS = parseInt(__ENV.VUS || "${vus}", 10);
const DURATION = __ENV.DURATION || "${duration}";

// Deterministic load shapes. The SAME scenario runs under each — only the shape
// of the traffic differs. Peak/duration scale off VUS / DURATION.
const PROFILES = {
  smoke:      { executor: "constant-vus", vus: 1, duration: "30s" },
  load:       { executor: "ramping-vus", startVUs: 0, stages: [
                 { duration: "30s", target: VUS },
                 { duration: DURATION, target: VUS },
                 { duration: "30s", target: 0 } ] },
  stress:     { executor: "ramping-vus", startVUs: 0, stages: [
                 { duration: "30s", target: VUS },
                 { duration: "1m",  target: VUS * 2 },
                 { duration: "1m",  target: VUS * 3 },
                 { duration: "30s", target: 0 } ] },
  spike:      { executor: "ramping-vus", startVUs: 0, stages: [
                 { duration: "10s", target: VUS },
                 { duration: "10s", target: VUS * 10 },
                 { duration: "1m",  target: VUS * 10 },
                 { duration: "20s", target: 0 } ] },
  soak:       { executor: "constant-vus", vus: VUS, duration: __ENV.SOAK_DURATION || "1h" },
  breakpoint: { executor: "ramping-arrival-rate", startRate: 10, timeUnit: "1s",
                 preAllocatedVUs: VUS * 2, maxVUs: VUS * 20, stages: [
                 { duration: "5m", target: 2000 } ] },
};

const PROFILE = __ENV.PROFILE || "smoke";
if (!PROFILES[PROFILE]) throw new Error("Unknown PROFILE '" + PROFILE + "'. One of: " + Object.keys(PROFILES).join(", "));

export const options = {
  scenarios: { [PROFILE]: Object.assign({ exec: "scenario" }, PROFILES[PROFILE]) },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  thresholds: {
    http_req_failed: ["rate<${errRate}"],
    http_req_duration: ["p(95)<${p95}"],
  },
};

// ---- scenario: built from your endpoints. Owns the requests + checks. ----
export function scenario() {
${indent(body, "  ")}
}

// Stable machine summary for Verity ingestion (works on any k6 version).
export function handleSummary(data) {
  const out = __ENV.K6_SUMMARY || "k6-summary.json";
  const d = (data.metrics.http_req_duration && data.metrics.http_req_duration.values) || {};
  const reqs = (data.metrics.http_reqs && data.metrics.http_reqs.values.count) || 0;
  const line = "profile=" + PROFILE + "  reqs=" + reqs + "  p95=" + Math.round(d["p(95)"] || 0) + "ms\\n";
  return { [out]: JSON.stringify(data), stdout: line };
}
`;
}

function defaultScenarioBody(): string {
  return [
    'const res = http.get(BASE_URL);',
    'check(res, { "status is 2xx/3xx": (r) => r.status < 400 });',
    "sleep(1);",
  ].join("\n");
}

function indent(s: string, pad: string): string {
  return s
    .split("\n")
    .map((l) => (l.trim() ? pad + l : l))
    .join("\n");
}
