import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentEvalSuite,
  sanitizeSuiteCases,
  suiteNeedsGrader,
  AGENT_REDTEAM_PACK,
  AGENT_SUITE_PATH,
} from "../src/agent-suite";
import { adaptAgentSuite, isAgentSuiteEndpointError } from "../src/adapters";

test("buildAgentEvalSuite: env-wired endpoint, red-team pack first, custom cases after", () => {
  const yaml = buildAgentEvalSuite({ cases: [{ description: "[format] Replies in JSON", input: "Give JSON", assert: [{ type: "is-json" }] }] });
  assert.match(yaml, /url: "\{\{ env\.AGENT_ENDPOINT \}\}"/);
  assert.match(yaml, /Authorization: "Bearer \{\{ env\.AI_API_TOKEN \}\}"/);
  assert.doesNotMatch(yaml, /https?:\/\/(?!localhost)[a-z]/i);
  assert.ok(yaml.indexOf(AGENT_REDTEAM_PACK[0].description) < yaml.indexOf("[format] Replies in JSON"));
  assert.match(yaml, /- type: is-json\n(?! {8}value)/);
  assert.match(yaml, /validateStatus: "status >= 200 && status < 300"/);
});

test("buildAgentEvalSuite: request field + response path are validated, not injected", () => {
  const ok = buildAgentEvalSuite({ cases: [], requestField: "prompt", responsePath: "data.choices[0]" });
  assert.match(ok, /prompt: "\{\{prompt\}\}"/);
  assert.match(ok, /transformResponse: "json\.data\.choices\[0\]"/);
  const bad = buildAgentEvalSuite({ cases: [], requestField: "a: b", responsePath: "process.exit(1)" });
  assert.match(bad, /message: "\{\{prompt\}\}"/);
  assert.doesNotMatch(bad, /process\.exit/);
});

test("sanitizeSuiteCases: drops malformed cases, bad regexes, unknown types, duplicates", () => {
  const cases = sanitizeSuiteCases([
    { description: "A", input: "hi", assert: [{ type: "contains", value: "x" }, { type: "javascript", value: "1" }] },
    { description: "a", input: "dup", assert: [{ type: "contains", value: "x" }] },
    { description: "B", input: "hi", assert: [{ type: "regex", value: "(" }] },
    { description: "C", input: "", assert: [{ type: "is-json" }] },
    { description: "D", input: "hi", assert: [{ type: "llm-rubric", value: "polite" }] },
    "nope",
  ]);
  assert.deepEqual(cases.map((c) => c.description), ["A", "D"]);
  assert.deepEqual(cases[0].assert, [{ type: "contains", value: "x" }]);
  assert.equal(suiteNeedsGrader(cases), true);
  assert.equal(suiteNeedsGrader(cases.slice(0, 1)), false);
});

// Row shapes captured from a real eval-engine run (pass, assertion fail, 401, timeout).
const pass = { success: true, failureReason: 0, testCase: { description: "Refund" }, latencyMs: 10, response: { output: "No refunds promised." }, gradingResult: { pass: true, reason: "All assertions passed" } };
const fail = { success: false, failureReason: 1, error: 'Expected output to not contain "CANARY"', testCase: { description: "Injection" }, latencyMs: 20, response: { output: "CANARY" }, gradingResult: { pass: false, reason: 'Expected output to not contain "CANARY"' } };
const unauthorized = { success: false, failureReason: 0, error: "No output", testCase: { description: "Auth" }, response: { metadata: { http: { status: 401 } } } };
const timeout = { success: false, failureReason: 2, error: "Evaluation timed out after 30000ms", testCase: { description: "Down" }, response: null };

test("adaptAgentSuite: repeats become attempts; failures carry reason + reply", () => {
  const rows = adaptAgentSuite({ results: { results: [pass, fail, { ...pass }, { ...fail, success: true }] } });
  assert.equal(rows.length, 2);
  const [refund, inj] = rows;
  assert.deepEqual(refund.attempts, [true, true]);
  assert.equal(refund.spec_path, `${AGENT_SUITE_PATH}#refund`);
  assert.equal(refund.discipline, "agent");
  assert.deepEqual(inj.attempts, [false, true]);
  assert.match(inj.error_message ?? "", /not contain "CANARY"\nReply: CANARY/);
});

test("adaptAgentSuite: endpoint errors are labelled as such, not as model failures", () => {
  assert.equal(isAgentSuiteEndpointError(unauthorized), true);
  assert.equal(isAgentSuiteEndpointError(timeout), true);
  assert.equal(isAgentSuiteEndpointError(fail), false);
  assert.equal(isAgentSuiteEndpointError(pass), false);
  const [auth] = adaptAgentSuite({ results: { results: [unauthorized] } });
  assert.match(auth.error_message ?? "", /^Endpoint error \(HTTP 401\)/);
  assert.deepEqual(adaptAgentSuite({}), []);
});
