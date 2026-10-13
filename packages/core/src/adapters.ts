/**
 * Per-engine result adapters. Each maps a tool's NATIVE output into Verity's
 * unified schema (UnifiedResult / Finding / PerfReport). Pure functions only —
 * no I/O, no env — so they are trivially unit-testable and reusable from both
 * the CI Action and the web app.
 *
 * The CI Action runs the tool, reads its output file, parses it (JSON via
 * JSON.parse, XML/SARIF via the tiny dep-free parsers here), runs the matching
 * adapter, and posts the result through the EXISTING /api/ingest endpoint using
 * the additive optional fields. The ingestion contract is never changed.
 */
import type {
  ApiLayer,
  Finding,
  GroupedApiEndpoint,
  GroupedApiEntry,
  PerfMetrics,
  PerfProfile,
  PerfReport,
  Severity,
  UnifiedResult,
} from "./disciplines";

/* ------------------------------------------------------------------ *
 * Tiny dependency-free parsers (JUnit XML, SARIF)                      *
 * ------------------------------------------------------------------ */

export interface JUnitCase {
  name: string;
  classname?: string;
  /** seconds */
  time?: number;
  ok: boolean;
  failureMessage?: string | null;
  skipped?: boolean;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&#9;/g, "\t")
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decodeXmlEntities(m[1]) : undefined;
}

/**
 * Minimal JUnit XML parser. Handles the `<testcase>` elements emitted by
 * Playwright (`--reporter junit`, used for UI + visual), Schemathesis
 * (`--junit-xml`) and the agent-eval runner. A `<testcase>` is a failure if it
 * contains a `<failure>` or `<error>` child; skipped if it contains `<skipped>`.
 */
/**
 * Extract the assertion error from a JUnit failure body: unwrap CDATA, drop ANSI
 * colour codes, and keep everything from the first "Error:" line. Returns null
 * when the body carries no such line (the message attribute is used instead).
 */
export function junitErrorDetail(body: string): string | null {
  const text = decodeXmlEntities(body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, "");
  const i = text.search(/^\s*Error:/m);
  if (i === -1) return null;
  const detail = text.slice(i).trim();
  return detail.length > 2000 ? `${detail.slice(0, 2000)}…` : detail;
}

export function parseJUnit(xml: string): JUnitCase[] {
  const cases: JUnitCase[] = [];
  if (!xml) return cases;
  // Match both self-closing <testcase ... /> and <testcase ...>...</testcase>.
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[3] ?? "";
    // A case can carry several <failure>s (Schemathesis emits one per distinct
    // problem on an operation); keep them all, not just the first.
    const fails = [...body.matchAll(/<(failure|error)\b([^>]*)(\/>|>([\s\S]*?)<\/(?:failure|error)>)/gi)];
    const failMatch = fails[0];
    const skipped = /<skipped\b/i.test(body);
    let failureMessage: string | null = null;
    if (failMatch) {
      // Playwright's message attribute is only "file:line title"; the real
      // assertion error lives in the (CDATA) body. Prefer it when present.
      failureMessage = fails
        .map((f) =>
          junitErrorDetail(f[4] ?? "") ||
          attr(f[2], "message") ||
          (f[4] ? decodeXmlEntities(f[4].trim()) : "") ||
          "Failed")
        .join("\n\n");
    }
    const timeStr = attr(attrs, "time");
    cases.push({
      name: attr(attrs, "name") ?? "case",
      classname: attr(attrs, "classname"),
      time: timeStr ? Number(timeStr) : undefined,
      ok: !failMatch && !skipped,
      failureMessage,
      skipped,
    });
  }
  return cases;
}

/** A SARIF 2.x document (only the fields the adapters read). */
export interface SarifLog {
  runs?: {
    tool?: { driver?: { name?: string; rules?: { id?: string; name?: string }[] } };
    results?: {
      ruleId?: string;
      level?: "error" | "warning" | "note" | "none";
      message?: { text?: string };
      locations?: {
        physicalLocation?: {
          artifactLocation?: { uri?: string };
          region?: { startLine?: number };
        };
      }[];
      properties?: { severity?: string; cwe?: string };
    }[];
  }[];
}

function sarifLevelToSeverity(level?: string): Severity {
  switch ((level ?? "").toLowerCase()) {
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "note":
      return "low";
    default:
      return "info";
  }
}

/**
 * Generic SARIF → Finding[] adapter. Both ZAP and Semgrep can emit SARIF, so
 * this is the common fallback path. `engine` tags the source. Prefer the native
 * JSON adapters below when available (they carry richer severity/CWE data).
 */
export function adaptSarif(sarif: SarifLog, engine: Finding["engine"]): Finding[] {
  const out: Finding[] = [];
  for (const run of sarif.runs ?? []) {
    for (const r of run.results ?? []) {
      const loc = r.locations?.[0]?.physicalLocation;
      out.push({
        engine,
        ruleId: r.ruleId ?? "unknown",
        title: r.ruleId ?? "Finding",
        severity: sarifLevelToSeverity(r.properties?.severity ?? r.level),
        message: r.message?.text ?? "",
        filePath: loc?.artifactLocation?.uri ?? null,
        line: loc?.region?.startLine ?? null,
        cwe: r.properties?.cwe ?? null,
      });
    }
  }
  return collapseFindings(out);
}

/* ------------------------------------------------------------------ *
 * 1a. VISUAL — Playwright screenshot regression (JUnit → UnifiedResult) *
 * ------------------------------------------------------------------ */

/**
 * Map a Playwright visual-regression run (toHaveScreenshot) to unified pass/fail
 * rows. Visual specs are ordinary Playwright tests, so they emit the same JUnit
 * output as UI flows — we just tag them discipline="visual" so the dashboard can
 * group them under a Visual panel. A failed case means a pixel diff exceeded the
 * threshold (or a baseline was missing).
 */
export function adaptVisual(junitXml: string): UnifiedResult[] {
  return parseJUnit(junitXml)
    .filter((c) => !c.skipped)
    .map((c) => ({
      spec_path: c.classname || c.name,
      name: c.name,
      attempts: [c.ok],
      duration_ms: c.time != null ? Math.round(c.time * 1000) : undefined,
      error_message: c.ok ? null : c.failureMessage ?? "Visual snapshot changed",
      discipline: "visual" as const,
      engine: "playwright-visual" as const,
    }));
}

/* ------------------------------------------------------------------ *
 * 1b. AGENT — LLM / AI-feature evals (JUnit → pass/fail UnifiedResult[]) *
 * ------------------------------------------------------------------ */

/**
 * Map an agent/LLM-eval run to unified pass/fail rows. Each eval case asserts a
 * property of the customer's AI feature (no hallucination, tool-call correct,
 * prompt-injection resisted, answer grounded, …) and reports pass/fail like any
 * other test. The runner emits JUnit so this mirrors the other pass/fail
 * adapters; the case name is the eval's title.
 */
/** One row of the eval-suite engine's JSON output (only the fields we read). */
export interface AgentSuiteRow {
  success?: boolean;
  failureReason?: number; // 0 none · 1 assertion · 2 error
  error?: string | null;
  latencyMs?: number;
  testIdx?: number;
  testCase?: { description?: string };
  vars?: Record<string, unknown>;
  response?: { output?: unknown; error?: string; metadata?: { http?: { status?: number } } } | null;
  gradingResult?: { pass?: boolean; reason?: string } | null;
}

/**
 * True when a suite row never got a usable reply (endpoint down, 401, timeout):
 * an execution failure, not a verdict on the model.
 */
export function isAgentSuiteEndpointError(r: AgentSuiteRow): boolean {
  if (r.success === true) return false;
  if (r.failureReason === 2) return true;
  return r.response?.output == null && Boolean(r.error || r.response?.error);
}

function suiteSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "case";
}

/**
 * 2b. AGENT EVAL SUITE — eval-suite JSON → agent UnifiedResult[].
 * Repeats of the same case (the engine's --repeat) become that case's
 * attempts[], so an inconsistent model reads as flaky through the existing
 * flake model. spec_path is `<suite file>#<case slug>` — stable per case.
 */
export function adaptAgentSuite(report: unknown, suitePath = "tests/verity/agent/verity.evals.yaml"): UnifiedResult[] {
  const rows: AgentSuiteRow[] = (report as { results?: { results?: AgentSuiteRow[] } })?.results?.results ?? [];
  const byCase = new Map<string, AgentSuiteRow[]>();
  for (const r of rows) {
    const key = r.testCase?.description || (r.vars ? JSON.stringify(r.vars) : `case ${r.testIdx ?? byCase.size}`);
    const list = byCase.get(key);
    if (list) list.push(r);
    else byCase.set(key, [r]);
  }
  return [...byCase.entries()].map(([name, runs]) => {
    const firstFail = runs.find((r) => r.success !== true);
    let error_message: string | null = null;
    if (firstFail) {
      if (isAgentSuiteEndpointError(firstFail)) {
        const status = firstFail.response?.metadata?.http?.status;
        error_message = `Endpoint error${status ? ` (HTTP ${status})` : ""}: ${firstFail.error || firstFail.response?.error || "no reply"}`;
      } else {
        error_message = firstFail.gradingResult?.reason || firstFail.error || "Agent eval failed";
        const out = firstFail.response?.output;
        if (out != null) {
          const text = typeof out === "string" ? out : JSON.stringify(out);
          error_message += `\nReply: ${text.length > 300 ? `${text.slice(0, 300)}…` : text}`;
        }
      }
    }
    const lat = runs.map((r) => r.latencyMs).filter((n): n is number => typeof n === "number");
    return {
      spec_path: `${suitePath}#${suiteSlug(name)}`,
      name,
      attempts: runs.map((r) => r.success === true),
      duration_ms: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : undefined,
      error_message,
      discipline: "agent" as const,
      engine: "llm-eval" as const,
    };
  });
}

export function adaptAgentEval(junitXml: string): UnifiedResult[] {
  return parseJUnit(junitXml)
    .filter((c) => !c.skipped)
    .map((c) => ({
      spec_path: c.classname || c.name,
      name: c.name,
      attempts: [c.ok],
      duration_ms: c.time != null ? Math.round(c.time * 1000) : undefined,
      error_message: c.ok ? null : c.failureMessage ?? "Agent eval failed",
      discipline: "agent" as const,
      engine: "llm-eval" as const,
    }));
}

/* ------------------------------------------------------------------ *
 * 2. PERFORMANCE — Artillery + Lighthouse (native JSON → PerfReport)   *
 * ------------------------------------------------------------------ */

/** Shape of Artillery's `--output report.json` aggregate (modern v2 reporter). */
export interface ArtilleryJson {
  aggregate?: {
    counters?: Record<string, number>;
    summaries?: Record<string, { min?: number; max?: number; median?: number; p95?: number; p99?: number; mean?: number }>;
    rates?: Record<string, number>;
    // older reporters:
    latency?: { min?: number; max?: number; median?: number; p95?: number; p99?: number };
    requestsCompleted?: number;
    scenariosCreated?: number;
    errors?: Record<string, number>;
  };
}

function artilleryMetrics(agg: NonNullable<ArtilleryJson["aggregate"]>): PerfMetrics {
  const counters = agg.counters ?? {};
  const rt = agg.summaries?.["http.response_time"] ?? agg.summaries?.["http.response_time.2xx"];
  // requests/responses
  const requests = counters["http.requests"] ?? agg.requestsCompleted ?? 0;
  const responses = counters["http.responses"] ?? requests;
  // errors: explicit error counters + any non-2xx/3xx status code counters + failed vusers
  let codeErrors = 0;
  for (const [k, v] of Object.entries(counters)) {
    const m = k.match(/^http\.codes\.(\d{3})$/);
    if (m) {
      const code = Number(m[1]);
      if (code >= 400) codeErrors += v;
    }
  }
  const explicitErrors = Object.entries(counters)
    .filter(([k]) => k.startsWith("errors."))
    .reduce((a, [, v]) => a + v, 0);
  const failedVusers = counters["vusers.failed"] ?? 0;
  const errors = Math.max(codeErrors + explicitErrors, failedVusers, Math.max(0, requests - responses));
  const denom = requests || responses || 0;
  const rps = agg.rates?.["http.request_rate"] ?? null;
  return {
    requests,
    errors,
    errorRate: denom > 0 ? Math.min(1, errors / denom) : 0,
    p50: rt?.median ?? agg.latency?.median ?? null,
    p95: rt?.p95 ?? agg.latency?.p95 ?? null,
    p99: rt?.p99 ?? agg.latency?.p99 ?? null,
    min: rt?.min ?? agg.latency?.min ?? null,
    max: rt?.max ?? agg.latency?.max ?? null,
    rps,
  };
}

export function adaptArtillery(json: ArtilleryJson, tier: "fast" | "full"): PerfReport {
  const agg = json.aggregate ?? {};
  return {
    engine: "artillery",
    tier,
    aggregate: artilleryMetrics(agg),
  };
}

/**
 * Shape of a k6 summary. We accept BOTH the object k6 hands to `handleSummary`
 * (`metrics[name].values["p(95)"]`) and the flatter `--summary-export` file
 * (`metrics[name]["p(95)"]`) so the adapter is robust to how the script emits.
 */
export interface K6Json {
  metrics?: Record<string, { values?: Record<string, number> } & Record<string, number | undefined>>;
}

function k6Vals(m: K6Json["metrics"], name: string): Record<string, number> {
  const entry = m?.[name];
  if (!entry) return {};
  // handleSummary nests under `.values`; --summary-export is flat.
  return (entry.values ?? (entry as Record<string, number>)) as Record<string, number>;
}

function k6Metrics(m: K6Json["metrics"]): PerfMetrics {
  const dur = k6Vals(m, "http_req_duration");
  const reqs = k6Vals(m, "http_reqs");
  const failed = k6Vals(m, "http_req_failed");
  const requests = Math.round(reqs.count ?? 0);
  // http_req_failed is a Rate metric: `rate` in [0,1] (handleSummary) or `value`
  // (--summary-export) is the fraction that FAILED. Its counters are a k6 gotcha:
  // `passes` = truthy adds = FAILED requests, `fails` = OK requests — so never
  // read `fails` as the error count. Prefer the rate; fall back to `passes`.
  const rate = failed.rate ?? failed.value;
  let errorRate: number;
  let errors: number;
  if (rate != null) { errorRate = rate; errors = Math.round(rate * requests); }
  else if (failed.passes != null) { errors = failed.passes; errorRate = requests > 0 ? failed.passes / requests : 0; }
  else { errors = 0; errorRate = 0; }
  const pick = (o: Record<string, number>, ...keys: string[]) => {
    for (const k of keys) if (o[k] != null) return Math.round(o[k]);
    return null;
  };
  return {
    requests,
    errors,
    errorRate: Math.min(1, Math.max(0, errorRate)),
    p50: pick(dur, "med", "p(50)"),
    p95: pick(dur, "p(95)"),
    p99: pick(dur, "p(99)"),
    min: pick(dur, "min"),
    max: pick(dur, "max"),
    rps: reqs.rate != null ? Math.round(reqs.rate * 10) / 10 : null,
  };
}

/**
 * Adapt a k6 summary into a PerfReport. `profile` is the load shape the run
 * used (smoke/load/stress/spike/soak/breakpoint); it rides along so the
 * dashboard can label the run precisely. `tier` keeps the fast/full honesty
 * split (smoke ⇒ fast, everything heavier ⇒ full).
 */
export function adaptK6(json: K6Json, tier: "fast" | "full", profile: PerfProfile): PerfReport {
  return {
    engine: "k6",
    tier,
    profile,
    aggregate: k6Metrics(json.metrics),
  };
}

/** Shape of a Lighthouse result (LHR) — only the audits we read. */
export interface LighthouseJson {
  categories?: { performance?: { score?: number | null } };
  audits?: Record<string, { numericValue?: number | null }>;
}

export function adaptLighthouse(lhr: LighthouseJson, tier: "fast" | "full"): PerfReport {
  const a = lhr.audits ?? {};
  const num = (k: string) => (a[k]?.numericValue != null ? Math.round(a[k]!.numericValue!) : null);
  const score = lhr.categories?.performance?.score;
  return {
    engine: "lighthouse",
    tier,
    // Lighthouse is a page-load score, not a load test — represent throughput as N/A.
    aggregate: { requests: 0, errors: 0, errorRate: 0, p50: null, p95: null, p99: null },
    webVitals: {
      performanceScore: score != null ? Math.round(score * 100) : null,
      lcp: num("largest-contentful-paint"),
      cls: a["cumulative-layout-shift"]?.numericValue ?? null,
      tbt: num("total-blocking-time"),
      fcp: num("first-contentful-paint"),
    },
  };
}

/* ------------------------------------------------------------------ *
 * 3. SECURITY — ZAP (DAST) + Semgrep (SAST) → Finding[]                *
 * ------------------------------------------------------------------ */

/** ZAP JSON report shape (traditional report, `site[].alerts[]`). */
export interface ZapJson {
  site?: {
    "@name"?: string;
    alerts?: {
      pluginid?: string;
      alertRef?: string;
      alert?: string;
      name?: string;
      riskcode?: string; // "0".."3"
      desc?: string;
      cweid?: string;
      instances?: { uri?: string }[];
      count?: string;
    }[];
  }[];
}

function zapRiskToSeverity(riskcode?: string): Severity {
  switch (riskcode) {
    case "3":
      return "high";
    case "2":
      return "medium";
    case "1":
      return "low";
    default:
      return "info";
  }
}

function stripHtml(s?: string): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function adaptZap(json: ZapJson): Finding[] {
  const out: Finding[] = [];
  for (const site of json.site ?? []) {
    for (const al of site.alerts ?? []) {
      out.push({
        engine: "zap",
        ruleId: al.pluginid ?? al.alertRef ?? "zap",
        title: al.alert ?? al.name ?? "ZAP alert",
        severity: zapRiskToSeverity(al.riskcode),
        message: stripHtml(al.desc),
        url: al.instances?.[0]?.uri ?? site["@name"] ?? null,
        cwe: al.cweid && al.cweid !== "-1" ? `CWE-${al.cweid}` : null,
        count: al.count ? Number(al.count) : al.instances?.length ?? 1,
      });
    }
  }
  return collapseFindings(out);
}

/** Semgrep JSON report shape (`results[]`). */
export interface SemgrepJson {
  results?: {
    check_id?: string;
    path?: string;
    start?: { line?: number };
    extra?: { message?: string; severity?: string; metadata?: { cwe?: string | string[] } };
  }[];
}

function semgrepSeverity(sev?: string): Severity {
  switch ((sev ?? "").toUpperCase()) {
    case "ERROR":
      return "high";
    case "WARNING":
      return "medium";
    case "INFO":
      return "low";
    default:
      return "info";
  }
}

export function adaptSemgrep(json: SemgrepJson): Finding[] {
  const out: Finding[] = [];
  for (const r of json.results ?? []) {
    const cweRaw = r.extra?.metadata?.cwe;
    const cwe = Array.isArray(cweRaw) ? cweRaw[0] : cweRaw;
    out.push({
      engine: "semgrep",
      ruleId: r.check_id ?? "semgrep",
      title: (r.check_id ?? "Finding").split(".").pop() ?? r.check_id ?? "Finding",
      severity: semgrepSeverity(r.extra?.severity),
      message: r.extra?.message ?? "",
      filePath: r.path ?? null,
      line: r.start?.line ?? null,
      cwe: cwe ? (cwe.startsWith("CWE") ? cwe.split(":")[0] : cwe) : null,
    });
  }
  return collapseFindings(out);
}

/** Collapse identical findings (same engine+rule+location), summing counts. */
export function collapseFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const f of findings) {
    const key = [f.engine, f.ruleId, f.filePath ?? "", f.line ?? "", f.url ?? ""].join("|");
    const existing = byKey.get(key);
    if (existing) existing.count = (existing.count ?? 1) + (f.count ?? 1);
    else byKey.set(key, { ...f, count: f.count ?? 1 });
  }
  return Array.from(byKey.values());
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Sort findings most-severe-first (for the Security panel). */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/* ------------------------------------------------------------------ *
 * 4. API CONTRACT — Schemathesis (JUnit XML → contract UnifiedResult[]) *
 * ------------------------------------------------------------------ */

/**
 * Map Schemathesis JUnit output to unified rows tagged layer="contract".
 * Schemathesis already shrinks failures to a minimal reproducing example before
 * output, so we report ONLY the final (one per operation) cases — never every
 * input it tried. Each test case name is the operation, e.g. "POST /users".
 */
/** Contract reports lead each case with "1. Test Case ID: <id>"; the problem is the useful headline. */
export function tidyContractMessage(m: string | null | undefined): string | null | undefined {
  return m ? m.replace(/^\s*\d+\.\s*Test Case ID:\s*\S+\s*\n+/gm, "").trim() || m : m;
}

export function adaptSchemathesis(junitXml: string): UnifiedResult[] {
  return parseJUnit(junitXml)
    .filter((c) => !c.skipped)
    .map((c) => {
      if (c.failureMessage) c.failureMessage = tidyContractMessage(c.failureMessage) ?? null;
      const endpoint = normalizeEndpoint(c.name);
      return {
        spec_path: `contract:${endpoint}`,
        name: c.name,
        attempts: [c.ok],
        duration_ms: c.time != null ? Math.round(c.time * 1000) : undefined,
        // Schemathesis already minimizes; the failure message IS the shrunk example.
        error_message: c.ok ? null : c.failureMessage ?? "Contract check failed",
        discipline: "api" as const,
        engine: "schemathesis" as const,
        layer: "contract" as const,
        endpoint,
        meaning: c.ok ? null : inferMeaning(c.failureMessage ?? ""),
      } satisfies UnifiedResult;
    });
}

/** Normalize a free-form test name into a "METHOD /path" endpoint key. */
export function normalizeEndpoint(name: string): string {
  const m = name.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b\s+(\/\S*)/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return name.trim();
}

/**
 * Derive a coarse "meaning" bucket from an error message so a flow failure and a
 * contract failure on the same endpoint+cause collapse into one entry. Heuristic
 * and intentionally conservative — only collapses on clear, well-known causes.
 */
export function inferMeaning(error: string): string | null {
  const e = error.toLowerCase();
  if (/\b5\d{2}\b/.test(e) && /(missing|required|null|undefined|empty)/.test(e)) return "missing-field-returns-5xx";
  if (/\b500\b/.test(e)) return "server-error-5xx";
  if (/\b(401|403)\b/.test(e) || /unauthor/.test(e)) return "auth-rejected";
  if (/\b404\b/.test(e)) return "not-found-404";
  if (/schema|does not (match|conform)|invalid response|content.type/.test(e)) return "response-schema-mismatch";
  return null;
}

/* ------------------------------------------------------------------ *
 * Dashboard grouping for API results: Flow vs Contract + dedup         *
 * ------------------------------------------------------------------ */

function statusOf(attempts: boolean[]): "passed" | "failed" | "flaky" {
  if (attempts.length === 0) return "failed";
  if (attempts.every(Boolean)) return "passed";
  if (attempts.some(Boolean)) return "flaky";
  return "failed";
}

/**
 * Group API results (flow + contract) by endpoint, then collapse duplicates.
 *
 * Rules (per spec):
 * - Group by endpoint, then by meaning — NOT by which engine produced them.
 * - Label each as "Flow" or "Contract"; never show "Playwright"/"Schemathesis".
 * - Dedup: if a flow result and a contract result surface a failure on the SAME
 *   endpoint with the SAME meaning, collapse into ONE entry tagged foundBy both.
 */
export function groupApiResults(results: UnifiedResult[]): GroupedApiEndpoint[] {
  const apiRows = results.filter((r) => (r.discipline ?? "api") === "api" || r.layer);
  const byEndpoint = new Map<string, UnifiedResult[]>();
  for (const r of apiRows) {
    const ep = r.endpoint || normalizeEndpoint(r.name ?? r.spec_path);
    if (!byEndpoint.has(ep)) byEndpoint.set(ep, []);
    byEndpoint.get(ep)!.push(r);
  }

  const out: GroupedApiEndpoint[] = [];
  for (const [endpoint, rows] of byEndpoint) {
    // Collapse by meaning when meaning is present and shared across layers.
    const byMeaning = new Map<string, UnifiedResult[]>();
    const singles: UnifiedResult[] = [];
    for (const r of rows) {
      if (r.meaning) {
        const key = r.meaning;
        if (!byMeaning.has(key)) byMeaning.set(key, []);
        byMeaning.get(key)!.push(r);
      } else {
        singles.push(r);
      }
    }

    const entries: GroupedApiEntry[] = [];
    for (const [meaning, group] of byMeaning) {
      const layers = Array.from(new Set(group.map((g) => layerOf(g)))) as ApiLayer[];
      const worst = group.reduce<UnifiedResult | null>((acc, g) => {
        const s = statusOf(g.attempts);
        if (!acc) return g;
        return s === "failed" ? g : acc;
      }, null)!;
      entries.push({
        description: group.find((g) => g.name)?.name ?? meaning,
        foundBy: layers,
        status: statusOf(worst.attempts),
        meaning,
        error_message: worst.error_message ?? null,
      });
    }
    for (const r of singles) {
      entries.push({
        description: r.name ?? r.spec_path,
        foundBy: [layerOf(r)],
        status: statusOf(r.attempts),
        meaning: r.meaning ?? null,
        error_message: r.error_message ?? null,
      });
    }
    out.push({ endpoint, entries });
  }
  return out.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

function layerOf(r: UnifiedResult): ApiLayer {
  return r.layer ?? "flow";
}
