#!/usr/bin/env node
/**
 * Verity CLI (Path B). Runs a discipline LOCALLY on your machine and POSTs the
 * results to the Verity ingestion API — the same contract CI uses, so a local
 * run and a CI run are interchangeable. Nothing runs on Verity's infra.
 *
 * Commands:
 *   verity run      --tier <fast|full>            # Playwright UI/API suite (flake-aware)
 *   verity perf     --profile <smoke|load|stress|spike|soak|breakpoint> --target <url> [--vus N] [--duration 2m]
 *   verity security --target <url> [--sast] [--dast]
 *
 * Common:
 *   --token $VERITY_INGEST_TOKEN   (or set VERITY_INGEST_TOKEN)
 *   --base  origin/main            (fast tier diff base, for `run`)
 * Env:
 *   VERITY_API_URL      defaults to https://verity.qashifthq.com
 *   VERITY_INGEST_TOKEN alternative to --token
 *   VERITY_RERUNS       default 3 (for `run`)
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name) { return process.argv.includes(`--${name}`); }

const cmd = process.argv[2];
const token = arg("token", process.env.VERITY_INGEST_TOKEN);
const apiUrl = (process.env.VERITY_API_URL ?? "https://verity.qashifthq.com").replace(/\/$/, "");

function git(args) {
  try { return execSync(`git ${args}`, { encoding: "utf8" }).trim(); } catch { return ""; }
}
const commitSha = git("rev-parse HEAD") || "unknown";
const branch = git("rev-parse --abbrev-ref HEAD") || "unknown";

function requireToken() {
  if (!token) { console.error("✗ Missing token. Pass --token or set VERITY_INGEST_TOKEN."); process.exit(1); }
}
async function postIngest(payload) {
  const res = await fetch(`${apiUrl}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`✗ Ingest failed (${res.status}): ${data.error ?? "unknown error"}`); process.exit(1); }
  return data;
}
function basePayload(tier) {
  return {
    tier,
    trigger: tier === "fast" ? "pr" : "merge",
    commit_sha: commitSha,
    branch,
    pr_number: process.env.VERITY_PR_NUMBER ? Number(process.env.VERITY_PR_NUMBER) : null,
    results: [],
  };
}

/* ============================== run (Playwright) ========================== */
/** Other disciplines' specs live beside UI/API under tests/verity/; never count them as UI. */
const OTHER_DISCIPLINE_DIRS = ["visual", "agent", "perf", "performance", "security", "contract"];
function uiPaths() {
  const root = "tests/verity";
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return []; }
  if (!entries.some((e) => e.isDirectory() && OTHER_DISCIPLINE_DIRS.includes(e.name))) return [];
  const keep = entries.filter((e) => !(e.isDirectory() && OTHER_DISCIPLINE_DIRS.includes(e.name))).map((e) => `${root}/${e.name}`);
  return keep.length ? keep : [`${root}/__verity_no_ui_specs__`];
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
function runPlaywright(paths, grep) {
  const grepArg = grep ? ["--grep", grep] : [];
  const res = spawnSync("npx", ["playwright", "test", ...paths, "--reporter=json", ...grepArg], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  try { return JSON.parse(res.stdout); } catch { return null; }
}
function firstError(spec) {
  for (const t of spec.tests ?? []) for (const r of t.results ?? []) {
    const e = r.error ?? r.errors?.[0];
    if (e?.message) { const m = stripAnsi(e.message).trim(); return m.length > 2000 ? `${m.slice(0, 2000)}…` : m; }
  }
  return null;
}
function collectSpecs(report) {
  const out = [];
  const walk = (suite, file) => {
    const f = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      const ok = spec.tests?.every((t) => t.results?.every((r) => r.status === "passed" || r.status === "expected"));
      out.push({ file: f, title: spec.title, ok: !!ok, error: ok ? null : firstError(spec) });
    }
    for (const child of suite.suites ?? []) walk(child, f);
  };
  for (const s of report?.suites ?? []) walk(s, s.file);
  return out;
}
async function cmdRun() {
  requireToken();
  const tier = arg("tier", "fast");
  const base = arg("base", "origin/main");
  const reruns = Number(process.env.VERITY_RERUNS ?? 3);
  if (tier !== "fast" && tier !== "full") { console.error("✗ --tier must be 'fast' or 'full'."); process.exit(1); }
  const changedFiles = tier === "fast" ? git(`diff --name-only ${base}...HEAD`).split("\n").filter(Boolean) : [];

  console.log(`▶ Verity ${tier === "fast" ? "Quick check" : "Full regression"} — commit ${commitSha.slice(0, 7)} on ${branch}`);
  const paths = uiPaths();
  const first = runPlaywright(paths);
  if (!first) { console.error("✗ Could not parse Playwright JSON output. Is @playwright/test installed?"); process.exit(1); }

  const specs = collectSpecs(first);
  const results = [];
  for (const spec of specs) {
    const attempts = [spec.ok];
    if (!spec.ok) {
      for (let i = 1; i < reruns; i++) {
        // Escape: a title with regex characters (parentheses, +, ?) must still match itself.
        const rerun = runPlaywright(paths, escapeRe(spec.title));
        const rs = collectSpecs(rerun).find((s) => s.title === spec.title && s.file === spec.file);
        attempts.push(rs ? rs.ok : false);
      }
    }
    results.push({ spec_path: spec.file, name: spec.title, attempts, error_message: spec.error });
  }

  const data = await postIngest({ ...basePayload(tier), changed_files: changedFiles, suite_total: specs.length, results });
  console.log(`✓ ${data.tier_label}: ${data.summary.passed} passed, ${data.summary.failed} failed, ${data.summary.flaky} flaky`);
  if (data.blocked) { console.error("✗ Full regression found real failures — failing the build."); process.exit(1); }
  process.exit(0);
}

/* ============================== perf (k6, local) ========================== */
function sh(command) { try { execSync(command, { stdio: "inherit", shell: "/bin/bash" }); } catch { /* keep going — tools exit non-zero on findings */ } }
function k6Vals(m, name) { const e = m && m[name]; if (!e) return {}; return e.values ?? e; }
function adaptK6(json, tier, profile) {
  const m = json.metrics ?? {};
  const dur = k6Vals(m, "http_req_duration"), reqs = k6Vals(m, "http_reqs"), failed = k6Vals(m, "http_req_failed");
  const requests = Math.round(reqs.count ?? 0);
  // http_req_failed Rate gotcha: `passes` = FAILED requests, `fails` = OK ones.
  const rate = failed.rate ?? failed.value;
  let errorRate, errors;
  if (rate != null) { errorRate = rate; errors = Math.round(rate * requests); }
  else if (failed.passes != null) { errors = failed.passes; errorRate = requests > 0 ? failed.passes / requests : 0; }
  else { errors = 0; errorRate = 0; }
  const pick = (o, ...ks) => { for (const k of ks) if (o[k] != null) return Math.round(o[k]); return null; };
  return {
    engine: "k6", tier, profile,
    aggregate: {
      requests, errors, errorRate: Math.min(1, Math.max(0, errorRate)),
      p50: pick(dur, "med", "p(50)"), p95: pick(dur, "p(95)"), p99: pick(dur, "p(99)"),
      min: pick(dur, "min"), max: pick(dur, "max"), rps: reqs.rate != null ? Math.round(reqs.rate * 10) / 10 : null,
    },
  };
}
async function cmdPerf() {
  requireToken();
  const PROFILES = ["smoke", "load", "stress", "spike", "soak", "breakpoint"];
  const profile = arg("profile", "smoke");
  const target = arg("target", process.env.VERITY_TARGET_URL ?? "");
  const config = arg("config", "tests/verity/perf/verity.k6.js");
  const tier = profile === "smoke" ? "fast" : "full";
  if (!PROFILES.includes(profile)) { console.error(`✗ --profile must be one of: ${PROFILES.join(", ")}`); process.exit(1); }
  if (!existsSync(config)) { console.error(`✗ Script not found: ${config}. Generate it from the dashboard (Performance → Configure).`); process.exit(1); }
  if (spawnSync("k6", ["version"], { stdio: "ignore" }).status !== 0) {
    console.error("✗ k6 is not installed. Install it: https://k6.io/docs/get-started/installation/ (brew install k6)"); process.exit(1);
  }
  const out = join(tmpdir(), `verity-k6-${Date.now()}.json`);
  let targetEnv = target ? `-e BASE_URL="${target}" ` : "";
  // Size knobs the generated script reads (peak concurrency / steady-phase length).
  if (arg("vus", "")) targetEnv += `-e VUS="${Number(arg("vus", "")) || 1}" `;
  if (arg("duration", "")) targetEnv += `-e DURATION="${arg("duration", "").replace(/[^0-9a-z]/gi, "")}" `;
  console.log(`▶ Verity performance — ${profile} profile${target ? ` vs ${target}` : ""}`);
  sh(`k6 run -e PROFILE="${profile}" -e K6_SUMMARY="${out}" ${targetEnv}"${config}"`);
  if (!existsSync(out)) { console.error("✗ k6 produced no summary (did the run fail to start?)."); process.exit(1); }
  const perf = adaptK6(JSON.parse(readFileSync(out, "utf8")), tier, profile);
  if (!(perf.aggregate.requests > 0)) { console.error("✗ The load test sent no requests — nothing was posted."); process.exit(1); }
  const data = await postIngest({ ...basePayload(tier), discipline: "performance", perf });
  const a = perf.aggregate;
  console.log(`✓ ${profile} — ${a.requests} reqs, p95 ${a.p95 ?? "—"}ms, errors ${(a.errorRate * 100).toFixed(1)}% (run ${data.run_id ?? "?"})`);
  process.exit(0);
}

/* ============================ security (local) ============================ */
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
  return out;
}
const HEADER_CHECKS = [
  { header: "content-security-policy", title: "Content Security Policy not set", severity: "medium", advice: "Add a Content-Security-Policy header to mitigate XSS and injection." },
  { header: "strict-transport-security", title: "HSTS not set", severity: "medium", advice: "Add Strict-Transport-Security so browsers force HTTPS." },
  { header: "x-frame-options", title: "Anti-clickjacking header missing", severity: "low", advice: "Set X-Frame-Options (or CSP frame-ancestors)." },
  { header: "x-content-type-options", title: "MIME-sniffing protection missing", severity: "low", advice: "Set X-Content-Type-Options: nosniff." },
  { header: "referrer-policy", title: "Referrer-Policy not set", severity: "info", advice: "Set Referrer-Policy to control referrer leakage." },
];
async function dastLite(url) {
  const findings = [];
  let res;
  // An unreachable target is an execution failure, never a clean scan.
  try { res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" }); }
  catch { return null; }
  const finalUrl = res.url || url;
  if (finalUrl.startsWith("http://")) findings.push({ engine: "zap", ruleId: "no-https", title: "Served over plaintext HTTP", severity: "high", message: "Traffic is not encrypted; serve over HTTPS.", url: finalUrl, cwe: "CWE-319" });
  for (const c of HEADER_CHECKS) if (!res.headers.get(c.header)) findings.push({ engine: "zap", ruleId: c.header, title: c.title, severity: c.severity, message: c.advice, url: finalUrl });
  const server = res.headers.get("server");
  if (server && /\d/.test(server)) findings.push({ engine: "zap", ruleId: "server-banner", title: "Server version disclosed", severity: "low", message: `The Server header reveals "${server}".`, url: finalUrl, cwe: "CWE-200" });
  return findings;
}
function runSemgrepLocal() {
  // Prefer a local semgrep binary; fall back to docker; skip cleanly if neither.
  const outFile = join(process.cwd(), ".verity-sast.json");
  if (spawnSync("semgrep", ["--version"], { stdio: "ignore" }).status === 0) {
    sh(`semgrep scan --config=auto --json --output="${outFile}" . || true`);
  } else if (spawnSync("docker", ["--version"], { stdio: "ignore" }).status === 0) {
    sh(`docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:latest semgrep scan --config=auto --json --output=/src/.verity-sast.json . || true`);
  } else {
    console.error("  · SAST unavailable — install semgrep (pip install semgrep) or docker.");
    return null;
  }
  // A missing/unparseable report or a fatal scanner error is a failed scan, never "0 findings".
  // Partial-parse notes are level "warn" and appear on most real repos — those are fine.
  let report;
  try { report = JSON.parse(readFileSync(outFile, "utf8")); } catch { return null; }
  if (!Array.isArray(report.results) || (report.errors ?? []).some((e) => e.level === "error")) return null;
  return adaptSemgrep(report);
}
async function cmdSecurity() {
  requireToken();
  const target = arg("target", process.env.VERITY_TARGET_URL ?? "");
  // Default: run both if no explicit flags; SAST needs a repo, DAST needs a URL.
  const explicit = flag("sast") || flag("dast");
  const doSast = explicit ? flag("sast") : true;
  const doDast = explicit ? flag("dast") : !!target;
  const tier = arg("tier", "fast");

  console.log(`▶ Verity security — ${[doSast && "code (SAST)", doDast && "app (DAST)"].filter(Boolean).join(" + ") || "nothing selected"}`);
  let findings = [];
  if (doSast) {
    const f = runSemgrepLocal();
    if (!f) { console.error("✗ Static scan did not complete — nothing was posted."); process.exit(1); }
    console.log(`  · SAST: ${f.length} finding(s)`); findings = findings.concat(f);
  }
  if (doDast) {
    if (!target) { console.error("✗ --dast needs --target <url>."); process.exit(1); }
    const f = await dastLite(target);
    if (!f) { console.error(`✗ Could not reach ${target} within 10s — nothing was posted.`); process.exit(1); }
    console.log(`  · DAST: ${f.length} finding(s)`); findings = findings.concat(f);
  }
  const data = await postIngest({ ...basePayload(tier), discipline: "security", findings });
  console.log(`✓ Security scan ingested — ${findings.length} finding(s) (run ${data.run_id ?? "?"}).`);
  process.exit(0);
}

/* ================================ dispatch =============================== */
const COMMANDS = { run: cmdRun, perf: cmdPerf, security: cmdSecurity };
if (!COMMANDS[cmd]) {
  console.log("Usage:");
  console.log("  verity run      --tier <fast|full> --token <token> [--base origin/main]");
  console.log("  verity perf     --profile <smoke|load|stress|spike|soak|breakpoint> --target <url> [--vus N] [--duration 2m] --token <token>");
  console.log("  verity security --target <url> [--sast] [--dast] --token <token>");
  process.exit(cmd ? 1 : 0);
}
COMMANDS[cmd]();
