import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseJUnit,
  adaptMaestro,
  adaptSchemathesis,
  adaptZap,
  adaptSemgrep,
  adaptArtillery,
  adaptLighthouse,
  collapseFindings,
  sortFindings,
  inferMeaning,
  normalizeEndpoint,
  groupApiResults,
  type UnifiedResult,
} from "../src/adapters";

test("parseJUnit: pass, fail, skipped", () => {
  const xml = `<testcase name="a" time="1.5"></testcase>
    <testcase name="b" time="2"><failure message="boom">trace</failure></testcase>
    <testcase name="c"><skipped/></testcase>`;
  const cases = parseJUnit(xml);
  assert.equal(cases.length, 3);
  assert.equal(cases[0].ok, true);
  assert.equal(cases[1].ok, false);
  assert.equal(cases[1].failureMessage, "boom");
  assert.equal(cases[2].skipped, true);
});

test("adaptMaestro: maps flows to pass/fail with mobile discipline", () => {
  const xml = `<testcase name="Login" classname="tests/verity/mobile/login.yaml" time="3"></testcase>
    <testcase name="Pay" classname="tests/verity/mobile/pay.yaml"><failure message="not found">x</failure></testcase>`;
  const r = adaptMaestro(xml);
  assert.equal(r.length, 2);
  assert.equal(r[0].discipline, "mobile");
  assert.equal(r[0].attempts[0], true);
  assert.equal(r[1].attempts[0], false);
  assert.equal(r[0].duration_ms, 3000);
});

test("adaptSchemathesis: contract layer + meaning inference, shrunk only", () => {
  const xml = `<testcase name="POST /users" time="0.4"><failure message="Server error 500 when required field email is missing">x</failure></testcase>
    <testcase name="GET /users"></testcase>`;
  const r = adaptSchemathesis(xml);
  assert.equal(r[0].layer, "contract");
  assert.equal(r[0].endpoint, "POST /users");
  assert.equal(r[0].meaning, "missing-field-returns-5xx");
  assert.equal(r[1].attempts[0], true);
});

test("inferMeaning: known causes", () => {
  assert.equal(inferMeaning("500 when required field missing"), "missing-field-returns-5xx");
  assert.equal(inferMeaning("401 Unauthorized"), "auth-rejected");
  assert.equal(inferMeaning("response did not conform to schema"), "response-schema-mismatch");
  assert.equal(inferMeaning("totally unrelated"), null);
});

test("normalizeEndpoint", () => {
  assert.equal(normalizeEndpoint("post /users created"), "POST /users");
  assert.equal(normalizeEndpoint("freeform name"), "freeform name");
});

test("adaptZap: risk → severity, CWE, html stripped", () => {
  const f = adaptZap({ site: [{ "@name": "https://x", alerts: [{ pluginid: "40012", alert: "XSS", riskcode: "3", desc: "<p>bad</p>", cweid: "79", instances: [{ uri: "https://x/s?q=1" }] }] }] });
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "high");
  assert.equal(f[0].cwe, "CWE-79");
  assert.equal(f[0].message, "bad");
  assert.equal(f[0].url, "https://x/s?q=1");
});

test("adaptSemgrep: severity map + file/line", () => {
  const f = adaptSemgrep({ results: [{ check_id: "py.sqli", path: "app.py", start: { line: 10 }, extra: { severity: "ERROR", message: "sqli", metadata: { cwe: ["CWE-89"] } } }] });
  assert.equal(f[0].severity, "high");
  assert.equal(f[0].filePath, "app.py");
  assert.equal(f[0].line, 10);
  assert.equal(f[0].cwe, "CWE-89");
});

test("collapseFindings + sortFindings", () => {
  const dup = collapseFindings([
    { engine: "zap", ruleId: "1", title: "a", severity: "low", message: "", url: "u" },
    { engine: "zap", ruleId: "1", title: "a", severity: "low", message: "", url: "u" },
  ]);
  assert.equal(dup.length, 1);
  assert.equal(dup[0].count, 2);
  const sorted = sortFindings([
    { engine: "zap", ruleId: "1", title: "", severity: "low", message: "" },
    { engine: "zap", ruleId: "2", title: "", severity: "critical", message: "" },
  ]);
  assert.equal(sorted[0].severity, "critical");
});

test("adaptArtillery: error rate from status codes", () => {
  const p = adaptArtillery({ aggregate: { counters: { "http.requests": 1000, "http.responses": 980, "http.codes.200": 950, "http.codes.500": 30 }, summaries: { "http.response_time": { median: 45, p95: 120, p99: 300 } } } }, "full");
  assert.equal(p.aggregate.requests, 1000);
  assert.equal(p.aggregate.errors, 30);
  assert.ok(Math.abs(p.aggregate.errorRate - 0.03) < 1e-9);
  assert.equal(p.aggregate.p95, 120);
});

test("adaptLighthouse: web vitals + score scaling", () => {
  const p = adaptLighthouse({ categories: { performance: { score: 0.86 } }, audits: { "largest-contentful-paint": { numericValue: 2400.5 }, "cumulative-layout-shift": { numericValue: 0.04 } } }, "fast");
  assert.equal(p.webVitals?.performanceScore, 86);
  assert.equal(p.webVitals?.lcp, 2401);
  assert.equal(p.webVitals?.cls, 0.04);
});

test("groupApiResults: collapses flow+contract on same endpoint+meaning → double-verified", () => {
  const flow: UnifiedResult = { spec_path: "f", name: "missing email 500", attempts: [false], discipline: "api", layer: "flow", endpoint: "POST /users", meaning: "missing-field-returns-5xx", error_message: "500" };
  const contract = adaptSchemathesis(`<testcase name="POST /users"><failure message="500 required field email missing">x</failure></testcase>`)[0];
  const grouped = groupApiResults([flow, contract]);
  const ep = grouped.find((g) => g.endpoint === "POST /users")!;
  assert.equal(ep.entries.length, 1, "flow + contract collapse to one entry");
  assert.deepEqual([...ep.entries[0].foundBy].sort(), ["contract", "flow"]);
  assert.equal(ep.entries[0].status, "failed");
});

test("groupApiResults: passing endpoint stays separate", () => {
  const grouped = groupApiResults([
    { spec_path: "x", name: "list ok", attempts: [true], discipline: "api", layer: "flow", endpoint: "GET /orders" },
  ]);
  assert.equal(grouped[0].entries[0].status, "passed");
  assert.deepEqual(grouped[0].entries[0].foundBy, ["flow"]);
});
