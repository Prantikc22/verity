import { test } from "node:test";
import assert from "node:assert/strict";
import { entitlementsFor } from "./entitlements";
import { planFor } from "./plans";
import { AUTONOMOUS } from "./catalog";

const GATES = ["maxTests", "maxProjects", "testGensPerMonth", "cloudRunsPerMonth", "cloudTrialsPerMonth", "maxRunHistory", "selfHealing", "prGating", "mergeBlocking", "predictionsGA", "predictionsBeta", "fde", "pomConversion"] as const;

test("before migration 0018 (legacy row only) gates equal planFor exactly", () => {
  for (const tier of ["free", "solo", "pro", "team", "starter", "growth", "scale", "enterprise"] as const) {
    const e = entitlementsFor({ plan: tier });
    const p = planFor(tier);
    for (const k of GATES) assert.equal(e[k], p[k], `${tier}.${k}`);
  }
});

test("null org behaves as free", () => {
  assert.equal(entitlementsFor(null).maxProjects, planFor("free").maxProjects);
});

test("every plan includes all six agents", () => {
  for (const org of [{ plan: "free" as const }, { plan: "free" as const, autonomous_plan: "builder" }, { plan: "scale" as const }]) {
    assert.deepEqual([...entitlementsFor(org).agents].sort(), ["accessibility", "api", "performance", "security", "ui", "visual"]);
  }
});

test("new autonomous plan applies its catalog limits", () => {
  const e = entitlementsFor({ plan: "free", autonomous_plan: "growth" });
  assert.equal(e.maxProjects, AUTONOMOUS.growth.maxProjects);
  assert.equal(e.creditsPerMonth, 600);
  assert.equal(e.mergeBlocking, true);
  assert.equal(e.label, "Growth");
});

test("grandfathered legacy plan is never reduced by a smaller new plan", () => {
  // Legacy Team: 10 projects. New Builder: 2 projects. Customer keeps 10.
  const e = entitlementsFor({ plan: "team", autonomous_plan: "builder", grandfathered: true });
  assert.equal(e.maxProjects, Math.max(planFor("team").maxProjects, AUTONOMOUS.builder.maxProjects));
  assert.ok(e.sources.includes("legacy:team") && e.sources.includes("autonomous:builder"));
  assert.equal(e.grandfathered, true);
});

test("reports-only org gets reports limits without agent upgrades", () => {
  const e = entitlementsFor({ plan: "free", reports_plan: "reports-team" });
  assert.equal(e.reports?.resultsPerMonth, 100000);
  assert.equal(e.maxProjects, 20);
  assert.equal(e.selfHealing, false);
  assert.equal(e.testGensPerMonth, planFor("free").testGensPerMonth);
});

test("managed plan includes its platform plan and FDE", () => {
  const e = entitlementsFor({ plan: "free", managed_plan: "growth" });
  assert.equal(e.fde, true);
  assert.equal(e.creditsPerMonth, AUTONOMOUS.scale.creditsPerMonth);
  assert.equal(e.managed?.engineerHours, 30);
});

test("unknown plan keys are ignored, not trusted", () => {
  const e = entitlementsFor({ plan: "free", autonomous_plan: "enterprise-hacked", reports_plan: "x" });
  assert.equal(e.maxProjects, planFor("free").maxProjects);
  assert.deepEqual(e.sources, ["legacy:free"]);
});
