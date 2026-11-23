import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAxe, diffScans } from "./index";

const axe = (rules: [string, string, number][]) => ({
  testEngine: { name: "axe-core", version: "4.10.0" },
  violations: rules.map(([id, impact, n]) => ({ id, impact, description: id, help: id, helpUrl: "", tags: ["wcag2a"], nodes: Array.from({ length: n }, () => ({ target: ["#x"], html: "<x>" })) })),
  passes: [], incomplete: [],
} as never);

test("normalize + diff: new, worsened and fixed rules", () => {
  const prev = normalizeAxe(axe([["color-contrast", "serious", 1], ["image-alt", "critical", 2]]), { url: "https://x" });
  const curr = normalizeAxe(axe([["color-contrast", "serious", 3], ["button-name", "critical", 1]]), { url: "https://x" });
  const d = diffScans(prev.issues, curr.issues);
  assert.deepEqual(d.new.map((r) => r.ruleId), ["button-name"]);
  assert.deepEqual(d.worsened.map((r) => r.ruleId), ["color-contrast"]);
  assert.deepEqual(d.fixed.map((r) => r.ruleId), ["image-alt"]);
});

test("first scan is a baseline (nothing reported as new regressions vs null)", () => {
  const curr = normalizeAxe(axe([["button-name", "critical", 1]]), { url: "https://x" });
  const d = diffScans(null, curr.issues);
  assert.equal(d.counts.worsened, 0);
});
