import { test } from "node:test";
import assert from "node:assert/strict";
import { a11yLimitsFor, isA11yPayload, buildA11ySummary } from "./pure";

test("payload validation", () => {
  assert.equal(isA11yPayload({ commit_sha: "a", branch: "main", pages: [{ url: "https://x", axe: {} }] }), true);
  assert.equal(isA11yPayload({ commit_sha: "a", branch: "main", pages: [] }), false);
  assert.equal(isA11yPayload({ tier: "full", results: [] }), false);
});

test("grandfathered accessibility plan is never reduced", () => {
  const free = { prGating: false, mergeBlocking: false, maxProjects: 1 };
  assert.equal(a11yLimitsFor(free).maxPagesPerScan, 5);
  const withLegacyGrowth = a11yLimitsFor(free, "growth");
  assert.equal(withLegacyGrowth.maxPagesPerScan, 100);
  assert.equal(withLegacyGrowth.mergeBlocking, true);
});

test("PR summary carries the marker, the regression and the workspace link", () => {
  const body = buildA11ySummary({ failed: true, pages: [{ url: "https://x/checkout", score: 82.4, scanId: "s", baseline: false, diff: { new: [{ ruleId: "button-name", impact: "critical", prevCount: 0, currCount: 1 }], fixed: [], worsened: [], unchanged: [], counts: { new: 1, fixed: 0, worsened: 0, unchanged: 0 } } }] }, "https://app.example", "p1");
  assert.match(body, /qashift-a11y-report/);
  assert.match(body, /button-name/);
  assert.match(body, /\/dashboard\/projects\/p1\/accessibility/);
  assert.doesNotMatch(body, /Clearpath|Verity/);
});
