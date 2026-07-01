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
 * Maestro (`--format junit`) and Schemathesis (`--junit-xml`). A `<testcase>`
 * is a failure if it contains a `<failure>` or `<error>` child; skipped if it
 * contains `<skipped>`.
 */
export function parseJUnit(xml: string): JUnitCase[] {
  const cases: JUnitCase[] = [];
  if (!xml) return cases;
  // Match both self-closing <testcase ... /> and <testcase ...>...</testcase>.
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[3] ?? "";
    const failMatch = body.match(/<(failure|error)\b([^>]*)(\/>|>([\s\S]*?)<\/(?:failure|error)>)/i);
    const skipped = /<skipped\b/i.test(body);
    let failureMessage: string | null = null;
    if (failMatch) {
      failureMessage =
        attr(failMatch[2], "message") ||
        (failMatch[4] ? decodeXmlEntities(failMatch[4].trim()) : "") ||
        "Failed";
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
 * 1. MOBILE — Maestro (JUnit XML → pass/fail UnifiedResult[])          *
 * ------------------------------------------------------------------ */

/**
 * Map Maestro's JUnit output to unified pass/fail rows (same shape as UI tests).
 * Maestro runs each `.yaml` flow as a test case named after the flow.
 */
export function adaptMaestro(junitXml: string): UnifiedResult[] {
  return parseJUnit(junitXml)
    .filter((c) => !c.skipped)
    .map((c) => ({
      spec_path: c.classname || c.name,
      name: c.name,
      attempts: [c.ok],
      duration_ms: c.time != null ? Math.round(c.time * 1000) : undefined,
      error_message: c.ok ? null : c.failureMessage ?? "Maestro flow failed",
      discipline: "mobile" as const,
      engine: "maestro" as const,
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
export function adaptSchemathesis(junitXml: string): UnifiedResult[] {
  return parseJUnit(junitXml)
    .filter((c) => !c.skipped)
    .map((c) => {
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
