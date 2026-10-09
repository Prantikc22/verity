#!/usr/bin/env node
/**
 * Verity multi-discipline engine runner (Path B, customer CI).
 *
 * This is an ADDITIVE companion to verity.mjs (which runs the Playwright UI/API
 * suite unchanged). It adapts the NATIVE output of a non-Playwright engine into
 * Verity's unified results schema and posts it through the SAME /api/ingest
 * endpoint, using the additive optional payload fields (discipline / findings /
 * perf). The ingestion API's external contract is never changed.
 *
 * Self-contained: the adapters are vendored here as plain JS (mirroring
 * packages/core/src/adapters.ts) so the Action needs no npm install — same model
 * as verity.mjs.
 *
 * Usage:
 *   node verity-engines.mjs <engine> --tier <fast|full> --report <file> [opts]
 *     engine ∈ visual | agent | perf | lighthouse | security-dast | security-sast | contract
 *
 * Env: VERITY_API_URL, VERITY_INGEST_TOKEN, VERITY_PR_NUMBER
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/* --------------------------- arg parsing --------------------------- */
const engine = process.argv[2];
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const tier = arg("tier", "fast");
let reportPath = arg("report", "");
const token = process.env.VERITY_INGEST_TOKEN;
const apiUrl = (process.env.VERITY_API_URL ?? "https://verity.qashift.com").replace(/\/$/, "");
// Optional inputs so the runner can RUN the underlying tool itself (so callers
// never name any tool in their CI config). When --report is given, we skip the
// run and just adapt that file (back-compat).
const target = arg("target", process.env.VERITY_TARGET_URL ?? "");
const spec = arg("spec", process.env.VERITY_OPENAPI_SPEC ?? "");
const config = arg("config", process.env.VERITY_PERF_CONFIG ?? "");
const snapshotsDir = arg("snapshots-dir", process.env.VERITY_VISUAL_SNAPSHOTS_DIR ?? "tests/verity/visual");
const evalsDir = arg("evals-dir", process.env.VERITY_AGENT_EVALS_DIR ?? "tests/verity/agent");
const endpoint = arg("endpoint", process.env.AGENT_ENDPOINT ?? "");
const base = arg("base", "origin/main");
// k6 load profile. Defaults from the tier: fast ⇒ smoke, full ⇒ load.
const PERF_PROFILES = ["smoke", "load", "stress", "spike", "soak", "breakpoint"];
let profile = arg("profile", process.env.VERITY_PERF_PROFILE ?? "");
if (!profile) profile = tier === "fast" ? "smoke" : "load";

const VALID = ["visual", "agent", "perf", "k6", "cwv", "lighthouse", "security-dast", "security-sast", "contract"];
if (!VALID.includes(engine)) {
  console.error(`✗ Unknown engine '${engine}'. Expected one of: ${VALID.join(", ")}`);
  process.exit(1);
}
if (!token) {
  console.error("✗ Missing VERITY_INGEST_TOKEN.");
  process.exit(1);
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}
const commitSha = git(["rev-parse", "HEAD"]) || "unknown";
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";

function readReport() {
  if (!reportPath || !existsSync(reportPath)) {
    console.error(`✗ Report file not found: ${reportPath}`);
    process.exit(1);
  }
  return readFileSync(reportPath, "utf8");
}

const tmp = process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp";
const reportId = randomUUID();
/**
 * Containerized tools run as a non-root user (ZAP and Schemathesis are uid 1000),
 * which cannot write into a CI checkout owned by the runner user. Give each run
 * its own world-writable output dir instead of writing into the customer's repo.
 */
function containerOutDir() {
  const dir = mkdtempSync(join(tmp, "verity-"));
  chmodSync(dir, 0o777);
  return dir;
}
function sh(file, args, env = {}) {
  // Tools may exit non-zero when they find issues; we still want their report.
  try { execFileSync(file, args, { stdio: "inherit", env: { ...process.env, ...env } }); } catch { /* keep going */ }
}

/**
 * Run the underlying engine to produce a native report, returning its path. This
 * is what lets a customer's CI config name only Verity — never the tool. Skipped
 * when --report was passed (already have output).
 */
function runEngine() {
  if (reportPath) return reportPath; // caller supplied a report; just adapt it
  switch (engine) {
    case "visual": {
      // Visual specs are ordinary Playwright tests whose assertion is
      // toHaveScreenshot; run them and emit JUnit for the adapter.
      const out = `${tmp}/verity-visual-${reportId}.xml`;
      sh("npx", ["--yes", "playwright", "test", snapshotsDir, "--reporter=junit"], { PLAYWRIGHT_JUNIT_OUTPUT_NAME: out });
      return out;
    }
    case "agent": {
      // Agent evals are Playwright API tests that assert a property of the AI
      // endpoint's reply; the endpoint is passed through to them via env.
      const out = `${tmp}/verity-agent-${reportId}.xml`;
      sh("npx", ["--yes", "playwright", "test", evalsDir, "--reporter=junit"], { AGENT_ENDPOINT: endpoint, PLAYWRIGHT_JUNIT_OUTPUT_NAME: out });
      return out;
    }
    case "perf": {
      const out = `${tmp}/verity-perf-${reportId}.json`;
      const cfg = config || `tests/verity/perf/${tier === "fast" ? "smoke" : "load"}.yml`;
      sh("npx", ["--yes", "artillery@latest", "run", "--output", out, cfg]);
      return out;
    }
    case "k6": {
      // One script, every profile. The script's handleSummary writes the JSON
      // summary to K6_SUMMARY; we point it at our temp file and adapt that.
      const out = `${tmp}/verity-k6-${reportId}.json`;
      const cfg = config || `tests/verity/perf/verity.k6.js`;
      if (!PERF_PROFILES.includes(profile)) { console.error(`✗ Unknown --profile '${profile}'. One of: ${PERF_PROFILES.join(", ")}`); process.exit(1); }
      const args = ["run", "-e", `PROFILE=${profile}`, "-e", `K6_SUMMARY=${out}`];
      if (target) args.push("-e", `BASE_URL=${target}`);
      args.push(cfg);
      sh("k6", args);
      return out;
    }
    case "cwv":
    case "lighthouse": {
      const out = `${tmp}/verity-cwv-${reportId}.json`;
      sh("npx", ["--yes", "lighthouse", target, "--quiet", "--chrome-flags=--headless --no-sandbox", "--only-categories=performance", "--output=json", `--output-path=${out}`]);
      return out;
    }
    case "security-sast": {
      let targets = ".";
      if (tier === "fast") {
        // Exclude deleted files: the scanner errors on a path that no longer exists.
        const changed = git(["diff", "--name-only", "--diff-filter=d", `${base}...HEAD`]).split("\n").filter(Boolean);
        targets = changed.length ? changed : ["."];
      }
      sh("docker", ["run", "--rm", "-v", `${process.cwd()}:/src`, "-w", "/src", "semgrep/semgrep:latest", "semgrep", "scan", "--config=auto", "--json", `--output=/src/.verity-sast-${reportId}.json`, ...targets]);
      return `${process.cwd()}/.verity-sast-${reportId}.json`;
    }
    case "security-dast": {
      const dir = containerOutDir();
      const script = tier === "fast" ? "zap-baseline.py" : "zap-full-scan.py";
      // Host network so a target started in the same CI job (localhost) is reachable.
      sh("docker", ["run", "--rm", "--network", "host", "-v", `${dir}:/zap/wrk:rw`, "ghcr.io/zaproxy/zaproxy:stable", script, "-t", target, "-J", "report.json"]);
      return join(dir, "report.json");
    }
    case "contract": {
      const dir = containerOutDir();
      sh("docker", ["run", "--rm", "--network", "host", "-v", `${process.cwd()}:/src:ro`, "-v", `${dir}:/out:rw`, "-w", "/src", "schemathesis/schemathesis:stable", "run", spec, "--url", target, "--report", "junit", "--report-junit-path", "/out/report.xml"]);
      return join(dir, "report.xml");
    }
    default:
      return "";
  }
}

/* ----------------- vendored adapters (mirror core) ----------------- */
function decodeXml(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#10;/g, "\n").replace(/&#9;/g, "\t").replace(/&amp;/g, "&");
}
function xattr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decodeXml(m[1]) : undefined;
}
function junitErrorDetail(body) {
  // eslint-disable-next-line no-control-regex
  const text = decodeXml(body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).replace(/\u001b\[[0-9;]*m/g, "");
  const i = text.search(/^\s*Error:/m);
  if (i === -1) return null;
  const detail = text.slice(i).trim();
  return detail.length > 2000 ? `${detail.slice(0, 2000)}…` : detail;
}
function parseJUnit(xml) {
  const cases = [];
  if (!xml) return cases;
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1], body = m[3] ?? "";
    // Several <failure>s per case are possible (Schemathesis: one per problem); keep all.
    const fails = [...body.matchAll(/<(failure|error)\b([^>]*)(\/>|>([\s\S]*?)<\/(?:failure|error)>)/gi)];
    const fail = fails[0];
    const skipped = /<skipped\b/i.test(body);
    let failureMessage = null;
    // Playwright's message attr is only "file:line title"; prefer the real error from the body.
    if (fail) failureMessage = fails.map(f => junitErrorDetail(f[4] ?? "") || xattr(f[2], "message") || (f[4] ? decodeXml(f[4].trim()) : "") || "Failed").join("\n\n");
    const t = xattr(attrs, "time");
    cases.push({ name: xattr(attrs, "name") ?? "case", classname: xattr(attrs, "classname"), time: t ? Number(t) : undefined, ok: !fail && !skipped, failureMessage, skipped });
  }
  return cases;
}
function normalizeEndpoint(name) {
  const m = name.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b\s+(\/\S*)/i);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : name.trim();
}
function inferMeaning(error) {
  const e = (error || "").toLowerCase();
  if (/\b5\d{2}\b/.test(e) && /(missing|required|null|undefined|empty)/.test(e)) return "missing-field-returns-5xx";
  if (/\b500\b/.test(e)) return "server-error-5xx";
  if (/\b(401|403)\b/.test(e) || /unauthor/.test(e)) return "auth-rejected";
  if (/\b404\b/.test(e)) return "not-found-404";
  if (/schema|does not (match|conform)|invalid response|content.type/.test(e)) return "response-schema-mismatch";
  return null;
}
function adaptVisual(xml) {
  return parseJUnit(xml).filter((c) => !c.skipped).map((c) => ({
    spec_path: c.classname || c.name, name: c.name, attempts: [c.ok],
    duration_ms: c.time != null ? Math.round(c.time * 1000) : undefined,
    error_message: c.ok ? null : c.failureMessage ?? "Visual snapshot changed",
    discipline: "visual", engine: "playwright-visual",
  }));
}
function adaptAgentEval(xml) {
  return parseJUnit(xml).filter((c) => !c.skipped).map((c) => ({
    spec_path: c.classname || c.name, name: c.name, attempts: [c.ok],
    duration_ms: c.time != null ? Math.round(c.time * 1000) : undefined,
    error_message: c.ok ? null : c.failureMessage ?? "Agent eval failed",
    discipline: "agent", engine: "llm-eval",
  }));
}
function adaptSchemathesis(xml) {
  return parseJUnit(xml).filter((c) => !c.skipped).map((c) => {
    const endpoint = normalizeEndpoint(c.name);
    return {
      spec_path: `contract:${endpoint}`, name: c.name, attempts: [c.ok],
      duration_ms: c.time != null ? Math.round(c.time * 1000) : undefined,
      error_message: c.ok ? null : c.failureMessage ?? "Contract check failed",
      discipline: "api", engine: "schemathesis", layer: "contract", endpoint,
      meaning: c.ok ? null : inferMeaning(c.failureMessage ?? ""),
    };
  });
}
function zapRisk(r) { return r === "3" ? "high" : r === "2" ? "medium" : r === "1" ? "low" : "info"; }
function stripHtml(s) { return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function adaptZap(json) {
  const out = [];
  for (const site of json.site ?? []) for (const al of site.alerts ?? []) out.push({
    engine: "zap", ruleId: al.pluginid ?? al.alertRef ?? "zap", title: al.alert ?? al.name ?? "ZAP alert",
    severity: zapRisk(al.riskcode), message: stripHtml(al.desc),
    url: (al.instances?.[0]?.uri) ?? site["@name"] ?? null,
    cwe: al.cweid && al.cweid !== "-1" ? `CWE-${al.cweid}` : null,
    count: al.count ? Number(al.count) : (al.instances?.length ?? 1),
  });
  return collapseFindings(out);
}
function semSev(s) { s = (s ?? "").toUpperCase(); return s === "ERROR" ? "high" : s === "WARNING" ? "medium" : s === "INFO" ? "low" : "info"; }
function adaptSemgrep(json) {
  const out = [];
  for (const r of json.results ?? []) {
    const cw = r.extra?.metadata?.cwe; const cwe = Array.isArray(cw) ? cw[0] : cw;
    out.push({
      engine: "semgrep", ruleId: r.check_id ?? "semgrep",
      title: (r.check_id ?? "Finding").split(".").pop() ?? "Finding",
      severity: semSev(r.extra?.severity), message: r.extra?.message ?? "",
      filePath: r.path ?? null, line: r.start?.line ?? null,
      cwe: cwe ? (String(cwe).startsWith("CWE") ? String(cwe).split(":")[0] : cwe) : null,
    });
  }
  return collapseFindings(out);
}
function collapseFindings(findings) {
  const byKey = new Map();
  for (const f of findings) {
    const key = [f.engine, f.ruleId, f.filePath ?? "", f.line ?? "", f.url ?? ""].join("|");
    const ex = byKey.get(key);
    if (ex) ex.count = (ex.count ?? 1) + (f.count ?? 1);
    else byKey.set(key, { ...f, count: f.count ?? 1 });
  }
  return [...byKey.values()];
}
function artilleryMetrics(agg) {
  const c = agg.counters ?? {};
  const rt = agg.summaries?.["http.response_time"] ?? agg.summaries?.["http.response_time.2xx"];
  const requests = c["http.requests"] ?? agg.requestsCompleted ?? 0;
  const responses = c["http.responses"] ?? requests;
  let codeErrors = 0;
  for (const [k, v] of Object.entries(c)) { const m = k.match(/^http\.codes\.(\d{3})$/); if (m && Number(m[1]) >= 400) codeErrors += v; }
  const explicit = Object.entries(c).filter(([k]) => k.startsWith("errors.")).reduce((a, [, v]) => a + v, 0);
  const failed = c["vusers.failed"] ?? 0;
  const errors = Math.max(codeErrors + explicit, failed, Math.max(0, requests - responses));
  const denom = requests || responses || 0;
  return {
    requests, errors, errorRate: denom > 0 ? Math.min(1, errors / denom) : 0,
    p50: rt?.median ?? agg.latency?.median ?? null, p95: rt?.p95 ?? agg.latency?.p95 ?? null,
    p99: rt?.p99 ?? agg.latency?.p99 ?? null, min: rt?.min ?? agg.latency?.min ?? null,
    max: rt?.max ?? agg.latency?.max ?? null, rps: agg.rates?.["http.request_rate"] ?? null,
  };
}
function adaptArtillery(json, t) { return { engine: "artillery", tier: t, aggregate: artilleryMetrics(json.aggregate ?? {}) }; }
function k6Vals(m, name) { const e = m && m[name]; if (!e) return {}; return e.values ?? e; }
function k6Metrics(m) {
  const dur = k6Vals(m, "http_req_duration"), reqs = k6Vals(m, "http_reqs"), failed = k6Vals(m, "http_req_failed");
  const requests = Math.round(reqs.count ?? 0);
  // http_req_failed Rate gotcha: `passes` = FAILED requests, `fails` = OK ones.
  // Prefer the rate; fall back to `passes`. Never read `fails` as errors.
  const rate = failed.rate ?? failed.value;
  let errorRate, errors;
  if (rate != null) { errorRate = rate; errors = Math.round(rate * requests); }
  else if (failed.passes != null) { errors = failed.passes; errorRate = requests > 0 ? failed.passes / requests : 0; }
  else { errors = 0; errorRate = 0; }
  const pick = (o, ...ks) => { for (const k of ks) if (o[k] != null) return Math.round(o[k]); return null; };
  return {
    requests, errors, errorRate: Math.min(1, Math.max(0, errorRate)),
    p50: pick(dur, "med", "p(50)"), p95: pick(dur, "p(95)"), p99: pick(dur, "p(99)"),
    min: pick(dur, "min"), max: pick(dur, "max"), rps: reqs.rate != null ? Math.round(reqs.rate * 10) / 10 : null,
  };
}
function adaptK6(json, t, prof) { return { engine: "k6", tier: t, profile: prof, aggregate: k6Metrics(json.metrics) }; }
function adaptLighthouse(lhr, t) {
  const a = lhr.audits ?? {};
  const num = (k) => (a[k]?.numericValue != null ? Math.round(a[k].numericValue) : null);
  const score = lhr.categories?.performance?.score;
  return {
    engine: "lighthouse", tier: t,
    aggregate: { requests: 0, errors: 0, errorRate: 0, p50: null, p95: null, p99: null },
    webVitals: {
      performanceScore: score != null ? Math.round(score * 100) : null,
      lcp: num("largest-contentful-paint"), cls: a["cumulative-layout-shift"]?.numericValue ?? null,
      tbt: num("total-blocking-time"), fcp: num("first-contentful-paint"),
    },
  };
}

/* ----------------------- build + post payload ---------------------- */
// Run the underlying tool (unless a --report was supplied), then adapt.
reportPath = runEngine();

// A missing/empty/error report is an execution failure, never a clean scan.
const evidence = readReport();
if (["visual", "agent", "contract"].includes(engine)) {
  if (!parseJUnit(evidence).some(c => !c.skipped)) throw new Error("No executed test cases in engine report.");
} else {
  const report = JSON.parse(evidence);
  if (["k6", "perf"].includes(engine)) {
    const metrics = engine === "k6" ? k6Metrics(report.metrics) : artilleryMetrics(report.aggregate ?? {});
    if (!(metrics.requests > 0)) throw new Error("No requests executed by performance engine.");
  }
  if (["cwv", "lighthouse"].includes(engine) && (report.runtimeError || typeof report.categories?.performance?.score !== "number")) throw new Error("Lighthouse did not complete a performance measurement.");
  if (engine === "security-sast" && (!Array.isArray(report.results) || report.errors?.length || !report.paths?.scanned?.length)) throw new Error("Static scan failed or scanned no files.");
  if (engine === "security-dast" && (!Array.isArray(report.site) || !report.site.length)) throw new Error("Dynamic scan inspected no sites.");
}

const basePayload = {
  tier,
  trigger: tier === "fast" ? "pr" : "merge",
  commit_sha: commitSha,
  branch,
  pr_number: process.env.VERITY_PR_NUMBER ? Number(process.env.VERITY_PR_NUMBER) : null,
  results: [],
};

let payload;
let label;
switch (engine) {
  case "visual": {
    const results = adaptVisual(readReport());
    payload = { ...basePayload, discipline: "visual", results };
    label = `Visual — ${results.length} snapshot(s)`;
    break;
  }
  case "agent": {
    const results = adaptAgentEval(readReport());
    payload = { ...basePayload, discipline: "agent", results };
    label = `Agent (AI) — ${results.length} eval(s)`;
    break;
  }
  case "contract": {
    const results = adaptSchemathesis(readReport());
    payload = { ...basePayload, discipline: "api", results };
    label = `API contract — ${results.length} operation(s)`;
    break;
  }
  case "perf": {
    const perf = adaptArtillery(JSON.parse(readReport()), tier);
    payload = { ...basePayload, discipline: "performance", results: [], perf };
    label = `Performance — ${tier === "fast" ? "smoke check" : "full load test"}`;
    break;
  }
  case "k6": {
    const perf = adaptK6(JSON.parse(readReport()), tier, profile);
    payload = { ...basePayload, discipline: "performance", results: [], perf };
    label = `Performance — ${profile} test`;
    break;
  }
  case "cwv":
  case "lighthouse": {
    const perf = adaptLighthouse(JSON.parse(readReport()), tier);
    payload = { ...basePayload, discipline: "performance", results: [], perf };
    label = `Performance — Core Web Vitals`;
    break;
  }
  case "security-dast": {
    const findings = adaptZap(JSON.parse(readReport()));
    payload = { ...basePayload, discipline: "security", results: [], findings };
    label = `Security (dynamic) — ${findings.length} finding(s)`;
    break;
  }
  case "security-sast": {
    const findings = adaptSemgrep(JSON.parse(readReport()));
    payload = { ...basePayload, discipline: "security", results: [], findings };
    label = `Security (code) — ${findings.length} finding(s)`;
    break;
  }
}

console.log(`▶ Verity ${label} — commit ${commitSha.slice(0, 7)} on ${branch}`);
const res = await fetch(`${apiUrl}/api/ingest`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`✗ Ingest failed (${res.status}): ${data.error ?? "unknown error"}`);
  process.exit(1);
}
console.log(`✓ ${data.tier_label ?? label} ingested (run ${data.run_id ?? "?"}).`);
// New disciplines never fail the build here — security findings are advisory and
// perf is informational; the dashboard/Check Run surfaces severity.
process.exit(0);
