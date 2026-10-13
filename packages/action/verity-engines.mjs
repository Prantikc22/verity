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
 *   agent: runs eval specs under --evals-dir and/or the eval suite (--suite,
 *          default <evals-dir>/verity.evals.yaml), repeated --repeat times
 *          (fast 1, full 3). AI-graded checks need VERITY_GRADER_API_KEY
 *          (+ optional VERITY_GRADER_BASE_URL / VERITY_GRADER_MODEL).
 *
 * Env: VERITY_API_URL, VERITY_INGEST_TOKEN, VERITY_PR_NUMBER
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, chmodSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join, relative, sep } from "node:path";
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
const apiUrl = (process.env.VERITY_API_URL ?? "https://verity.qashifthq.com").replace(/\/$/, "");
// Optional inputs so the runner can RUN the underlying tool itself (so callers
// never name any tool in their CI config). When --report is given, we skip the
// run and just adapt that file (back-compat).
const target = arg("target", process.env.VERITY_TARGET_URL ?? "");
const spec = arg("spec", process.env.VERITY_OPENAPI_SPEC ?? "");
const config = arg("config", process.env.VERITY_PERF_CONFIG ?? "");
const snapshotsDir = arg("snapshots-dir", process.env.VERITY_VISUAL_SNAPSHOTS_DIR ?? "tests/verity/visual");
const evalsDir = arg("evals-dir", process.env.VERITY_AGENT_EVALS_DIR ?? "tests/verity/agent");
const endpoint = arg("endpoint", process.env.AGENT_ENDPOINT ?? "");
// Agent eval suite (scored, multi-case). Optional; runs alongside any eval specs.
const suitePath = arg("suite", process.env.VERITY_AGENT_SUITE ?? `${evalsDir}/verity.evals.yaml`);
// Replies vary: Full regression asks each case 3x so inconsistency reads as flaky.
const repeat = Math.max(1, Math.min(10, Number(arg("repeat", process.env.VERITY_AGENT_REPEAT ?? (tier === "full" ? "3" : "1"))) || 1));
const graderKey = process.env.VERITY_GRADER_API_KEY ?? "";
const graderBaseUrl = process.env.VERITY_GRADER_BASE_URL ?? "";
const graderModel = process.env.VERITY_GRADER_MODEL || "gpt-4o-mini";
// Pinned open-source eval engine (MIT). Run as a CLI subprocess; never named to customers.
const EVAL_ENGINE = "promptfoo@0.123.1";
const base = arg("base", "origin/main");
// Visual: allowed pixel drift before a snapshot counts as changed (CI-wide default).
const maxDiffRatio = arg("max-diff-ratio", process.env.VERITY_VISUAL_MAX_DIFF_RATIO ?? "");
// Load-test size knobs read by the generated script (VUS / DURATION).
const perfVus = arg("vus", process.env.VERITY_PERF_VUS ?? "");
const perfDuration = arg("duration", process.env.VERITY_PERF_DURATION ?? "");
// Dynamic scan depth: baseline (passive) or full (active). Empty ⇒ from tier.
const dastDepth = arg("depth", process.env.VERITY_DAST_DEPTH ?? "") || (tier === "fast" ? "baseline" : "full");
// The full active scan has no natural end on a large app; bound it (minutes).
const dastMaxMinutes = String(Math.max(1, Number(arg("max-minutes", process.env.VERITY_DAST_MAX_MINUTES ?? "30")) || 30));
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
 * The CI-wide visual threshold (visual-max-diff-ratio) becomes the default for
 * every toHaveScreenshot via a throwaway config that extends the repo's own
 * Playwright config. Per-assertion options in a spec still win.
 */
function visualConfigArgs() {
  const ratio = Number(maxDiffRatio);
  if (!maxDiffRatio || !(ratio >= 0 && ratio <= 1)) return [];
  const own = ["playwright.config.ts", "playwright.config.mts", "playwright.config.cts", "playwright.config.js", "playwright.config.mjs", "playwright.config.cjs"].find((f) => existsSync(f));
  // Same extension as the repo's config, so Playwright loads both the same way (TS, ESM or CJS).
  const ext = own ? own.slice(own.lastIndexOf(".")) : ".mjs";
  let esm = [".ts", ".mts", ".mjs"].includes(ext);
  if (ext === ".js") { try { esm = JSON.parse(readFileSync("package.json", "utf8")).type === "module"; } catch { esm = false; } }
  const spec = ext === ".ts" ? "./playwright.config" : `./${own}`;
  const load = !own ? "const base = {};" : esm ? `import base from "${spec}";` : `const _c = require("${spec}"); const base = _c.default ?? _c;`;
  const shot = `toHaveScreenshot: { ...(base.expect?.toHaveScreenshot ?? {}), maxDiffPixelRatio: ${ratio} }`;
  const exp = `{ ...base, expect: { ...(base.expect ?? {}), ${shot} } }`;
  const path = `.verity-visual-${reportId}.config${ext}`;
  writeFileSync(path, `${load}\n${esm ? `export default ${exp};` : `module.exports = ${exp};`}\n`);
  return ["--config", path];
}

/** Playwright writes a missing baseline then fails the test. That's a first run, not a regression. */
const NEW_BASELINE = /A snapshot doesn't exist at (\S+?)(?:,|\s|$)/;
function newBaselines(results) {
  return results.filter((r) => r.error_message && NEW_BASELINE.test(r.error_message)).map((r) => r.error_message.match(NEW_BASELINE)[1].replace(/\.$/, ""));
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
      const cfgArgs = visualConfigArgs();
      try {
        sh("npx", ["--yes", "playwright", "test", snapshotsDir, ...cfgArgs, "--reporter=junit"], { PLAYWRIGHT_JUNIT_OUTPUT_NAME: out });
      } finally {
        if (cfgArgs.length) rmSync(cfgArgs[1], { force: true });
      }
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
      if (Number(perfVus) > 0) args.push("-e", `VUS=${Math.round(Number(perfVus))}`);
      if (/^\d+(ms|s|m|h)$/.test(perfDuration)) args.push("-e", `DURATION=${perfDuration}`);
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
      if (!["baseline", "full"].includes(dastDepth)) { console.error(`✗ Unknown --depth '${dastDepth}'. One of: baseline, full`); process.exit(1); }
      // baseline = passive (spider + inspect responses); full = active attack scan, time-boxed.
      const zapArgs = dastDepth === "full" ? ["zap-full-scan.py", "-t", target, "-J", "report.json", "-m", "5", "-T", dastMaxMinutes] : ["zap-baseline.py", "-t", target, "-J", "report.json"];
      // Host network so a target started in the same CI job (localhost) is reachable.
      sh("docker", ["run", "--rm", "--network", "host", "-v", `${dir}:/zap/wrk:rw`, "ghcr.io/zaproxy/zaproxy:stable", ...zapArgs]);
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

/**
 * Agent evals have two optional sources, merged into ONE agent run:
 *  - Playwright eval specs under evalsDir (*.spec.ts) → JUnit
 *  - the scored eval suite (verity.evals.yaml) → eval-engine JSON
 * With --report, adapt that one file instead (.json = suite, else JUnit).
 */
function hasEvalSpecs(dir) {
  try {
    return readdirSync(dir, { recursive: true }).some((f) => /\.(spec|test)\.[cm]?[jt]s$/.test(String(f)));
  } catch { return false; }
}
function runEvalSuite(cfg) {
  if (!endpoint) throw new Error("The agent eval suite needs your AI endpoint: set agent-endpoint (AGENT_ENDPOINT).");
  const out = `${tmp}/verity-agent-suite-${reportId}.json`;
  const env = {
    AGENT_ENDPOINT: endpoint,
    PROMPTFOO_DISABLE_TELEMETRY: "1", PROMPTFOO_DISABLE_UPDATE: "1", PROMPTFOO_DISABLE_SHARING: "1",
    PROMPTFOO_DISABLE_REMOTE_GENERATION: "1",
    // Bounded: an unreachable endpoint otherwise retries for many minutes.
    PROMPTFOO_REQUEST_BACKOFF_MS: process.env.PROMPTFOO_REQUEST_BACKOFF_MS ?? "1000",
    REQUEST_TIMEOUT_MS: process.env.REQUEST_TIMEOUT_MS ?? "60000",
    PROMPTFOO_EVAL_TIMEOUT_MS: process.env.PROMPTFOO_EVAL_TIMEOUT_MS ?? "180000",
  };
  const args = ["eval", "-c", cfg, "-o", out, "--repeat", String(repeat), "--no-cache", "--no-progress-bar", "--no-table", "--no-share"];
  if (/type:\s*["']?llm-rubric/.test(readFileSync(cfg, "utf8"))) {
    if (!graderKey) throw new Error("This eval suite has AI-graded checks: set grader-api-key (VERITY_GRADER_API_KEY), or remove the llm-rubric assertions.");
    env.OPENAI_API_KEY = graderKey;
    if (graderBaseUrl) env.OPENAI_BASE_URL = graderBaseUrl;
    args.push("--grader", `openai:chat:${graderModel}`);
  }
  // The engine needs Node >= 22.22; on older CI Node, fetch a matching Node via npx.
  const [maj, min] = process.versions.node.split(".").map(Number);
  const modern = maj > 22 || (maj === 22 && min >= 22);
  sh("npx", modern ? ["--yes", EVAL_ENGINE, ...args] : ["--yes", "-p", "node@22", "-p", EVAL_ENGINE, "--", "promptfoo", ...args], env);
  return out;
}
function runAgent() {
  const sources = [];
  if (reportPath) sources.push({ kind: reportPath.endsWith(".json") ? "suite" : "junit", path: reportPath });
  else {
    if (hasEvalSpecs(evalsDir)) {
      // Playwright API tests asserting a property of the AI endpoint's reply.
      const out = `${tmp}/verity-agent-${reportId}.xml`;
      sh("npx", ["--yes", "playwright", "test", evalsDir, "--reporter=junit"], { AGENT_ENDPOINT: endpoint, PLAYWRIGHT_JUNIT_OUTPUT_NAME: out });
      sources.push({ kind: "junit", path: out });
    }
    if (existsSync(suitePath)) sources.push({ kind: "suite", path: runEvalSuite(suitePath) });
    if (!sources.length) throw new Error(`No agent evals found: add eval specs under ${evalsDir} or the eval suite at ${suitePath}.`);
  }
  const results = [];
  for (const src of sources) {
    if (!existsSync(src.path)) throw new Error(`Agent eval report not produced: ${src.path}`);
    const text = readFileSync(src.path, "utf8");
    if (src.kind === "junit") { results.push(...adaptAgentEval(text)); continue; }
    const report = JSON.parse(text);
    const rows = report.results?.results ?? [];
    // Every case failed to get a reply ⇒ the endpoint is down/unauthorized: an
    // execution failure, never a verdict on the model.
    if (rows.length && rows.every(isAgentSuiteEndpointError)) {
      const r = rows[0], status = r.response?.metadata?.http?.status;
      throw new Error(`AI endpoint gave no usable reply${status ? ` (HTTP ${status})` : ""}: ${r.error || r.response?.error || "no output"}. Check agent-endpoint / agent-token.`);
    }
    // The engine aborts on a non-transient target error (401/403/404) and writes
    // only the rows finished so far; a cut-short run is never a verdict.
    const cases = Array.isArray(report.config?.tests) ? report.config.tests.length : 0;
    if (!reportPath && cases && rows.length < cases * repeat) {
      const bad = rows.find(isAgentSuiteEndpointError), status = bad?.response?.metadata?.http?.status;
      throw new Error(`Agent eval suite was cut short (${rows.length} of ${cases * repeat} runs)${bad ? `: endpoint error${status ? ` HTTP ${status}` : ""} — ${bad.error || "no reply"}` : ""}. Check agent-endpoint / agent-token.`);
    }
    results.push(...adaptAgentSuite(report, reportPath ? "tests/verity/agent/verity.evals.yaml" : suitePath));
  }
  if (!results.length) throw new Error("No executed test cases in engine report.");
  return results;
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
function isAgentSuiteEndpointError(r) {
  if (r.success === true) return false;
  if (r.failureReason === 2) return true;
  return r.response?.output == null && Boolean(r.error || r.response?.error);
}
function suiteSlug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "case"; }
function adaptAgentSuite(report, path) {
  const byCase = new Map();
  for (const r of report?.results?.results ?? []) {
    const key = r.testCase?.description || (r.vars ? JSON.stringify(r.vars) : `case ${r.testIdx ?? byCase.size}`);
    (byCase.get(key) ?? byCase.set(key, []).get(key)).push(r);
  }
  return [...byCase.entries()].map(([name, runs]) => {
    const f = runs.find((r) => r.success !== true);
    let error_message = null;
    if (f) {
      if (isAgentSuiteEndpointError(f)) {
        const status = f.response?.metadata?.http?.status;
        error_message = `Endpoint error${status ? ` (HTTP ${status})` : ""}: ${f.error || f.response?.error || "no reply"}`;
      } else {
        error_message = f.gradingResult?.reason || f.error || "Agent eval failed";
        const out = f.response?.output;
        if (out != null) { const t = typeof out === "string" ? out : JSON.stringify(out); error_message += `\nReply: ${t.length > 300 ? `${t.slice(0, 300)}…` : t}`; }
      }
    }
    const lat = runs.map((r) => r.latencyMs).filter((n) => typeof n === "number");
    return {
      spec_path: `${path}#${suiteSlug(name)}`, name, attempts: runs.map((r) => r.success === true),
      duration_ms: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : undefined,
      error_message, discipline: "agent", engine: "llm-eval",
    };
  });
}
/** Contract reports lead each case with "1. Test Case ID: <id>"; the problem is the useful headline. */
function tidyContractMessage(m) {
  return m ? m.replace(/^\s*\d+\.\s*Test Case ID:\s*\S+\s*\n+/gm, "").trim() || m : m;
}
function adaptSchemathesis(xml) {
  return parseJUnit(xml).filter((c) => !c.skipped).map((c) => {
    if (c.failureMessage) c.failureMessage = tidyContractMessage(c.failureMessage);
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
// Agent merges its two optional sources itself (and checks its own evidence).
const agentResults = engine === "agent" ? runAgent() : null;
if (engine !== "agent") reportPath = runEngine();

// A missing/empty/error report is an execution failure, never a clean scan.
const evidence = engine === "agent" ? "" : readReport();
if (engine === "agent") { /* evidence checked in runAgent */ }
else if (["visual", "contract"].includes(engine)) {
  if (!parseJUnit(evidence).some(c => !c.skipped)) throw new Error("No executed test cases in engine report.");
} else {
  const report = JSON.parse(evidence);
  if (["k6", "perf"].includes(engine)) {
    const metrics = engine === "k6" ? k6Metrics(report.metrics) : artilleryMetrics(report.aggregate ?? {});
    if (!(metrics.requests > 0)) throw new Error("No requests executed by performance engine.");
  }
  if (["cwv", "lighthouse"].includes(engine) && (report.runtimeError || typeof report.categories?.performance?.score !== "number")) throw new Error("Lighthouse did not complete a performance measurement.");
  // Only level "error" is fatal: partial-parse notes are "warn" and appear on most real repos.
  const sastFatal = (report.errors ?? []).filter((e) => e.level === "error");
  if (engine === "security-sast" && (!Array.isArray(report.results) || sastFatal.length || !report.paths?.scanned?.length)) throw new Error(`Static scan failed or scanned no files.${sastFatal[0]?.message ? ` ${String(sastFatal[0].message).slice(0, 300)}` : ""}`);
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
    const created = newBaselines(results);
    for (const r of results) {
      if (r.error_message && NEW_BASELINE.test(r.error_message)) {
        // Nothing to compare against yet: record the capture, not a regression.
        r.attempts = [true];
        r.error_message = null;
      }
    }
    if (created.length) {
      const rel = created.map((p) => relative(process.cwd(), p).split(sep).join("/"));
      console.log(`ℹ ${created.length} new visual baseline(s) captured on this runner — commit them so later runs compare against them:`);
      for (const p of rel) console.log(`    ${p}`);
      if (process.env.GITHUB_OUTPUT) {
        // Unique per run: matrix jobs share a job id, and same-named artifacts overwrite each other.
        const name = `verity-visual-baselines-${process.env.GITHUB_JOB ?? "job"}-${reportId.slice(0, 8)}`;
        writeFileSync(process.env.GITHUB_OUTPUT, `new-baselines-name=${name}\nnew-baselines<<VERITY_EOF\n${rel.join("\n")}\nVERITY_EOF\n`, { flag: "a" });
        console.log(`  Download them from the "${name}" artifact of this run.`);
      }
    }
    payload = { ...basePayload, discipline: "visual", results };
    label = `Visual — ${results.length} snapshot(s)${created.length ? `, ${created.length} new baseline(s)` : ""}`;
    break;
  }
  case "agent": {
    const results = agentResults;
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
