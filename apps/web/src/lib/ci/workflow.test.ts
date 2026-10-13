import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { DEFAULT_CONFIG, githubWorkflow, gitlabWorkflow, jenkinsWorkflow, enginesCsv, type CiConfig } from "./workflow";

// js-yaml ships with the ESLint toolchain; a real YAML parser is the point of this test.
const yaml = createRequire(import.meta.url)("js-yaml") as { load: (s: string) => unknown };

function everything(): CiConfig {
  const c = structuredClone(DEFAULT_CONFIG);
  c.engines = { ui: true, apiFlow: true, contract: true, visual: true, agent: true, perf: true, security: true };
  c.agent.endpoint = "https://api.example.com/chat";
  c.agent.aiGrading = true;
  c.perf = { ...c.perf, lighthouse: true, lighthouseUrl: "https://staging.example.com", profile: "stress", arrivalRate: 25, durationSec: 90 };
  c.security = { ...c.security, dast: true, dastTarget: "https://staging.example.com", dastDepth: "baseline" };
  c.contract = { openapiSpec: "openapi.yaml", apiBaseUrl: "https://staging.example.com" };
  return c;
}

type Step = { name?: string; uses?: string; with?: Record<string, string> };
function veritySteps(c: CiConfig) {
  const doc = yaml.load(githubWorkflow(c)) as { jobs: { verity: { steps: Step[] } } };
  const steps = doc.jobs.verity.steps.filter((s) => s.uses?.startsWith("qashift/verity-action"));
  const by = (n: string) => steps.find((s) => s.name === n)!.with!;
  return { fast: by("Verity (fast)"), full: by("Verity (full)") };
}

test("GitHub workflow is valid YAML with inputs nested under the action step", () => {
  for (const c of [DEFAULT_CONFIG, everything()]) {
    const { fast, full } = veritySteps(c);
    assert.equal(fast.tier, "fast");
    assert.equal(full.tier, "full");
    assert.match(fast.token, /secrets\.VERITY_INGEST_TOKEN/);
  }
});

test("every CI Setup control reaches the generated GitHub config", () => {
  const { fast, full } = veritySteps(everything());
  assert.equal(full["perf-profile"], "stress");
  assert.equal(full["perf-vus"], "25");
  assert.equal(full["perf-duration"], "90s");
  assert.equal(fast["perf-profile"], undefined, "PRs always run the smoke profile");
  assert.equal(full["security-dast-depth"], "baseline");
  assert.equal(fast["security-dast-depth"], "baseline");
  assert.equal(full["visual-max-diff-ratio"], "0.01");
  assert.match(full["grader-api-key"], /VERITY_GRADER_API_KEY/);
});

test("switched-off checks are switched off", () => {
  const c = everything();
  c.perf.smoke = false;
  c.perf.lighthouse = false;
  c.security.sast = false;
  const { fast, full } = veritySteps(c);
  assert.ok(!fast.engines.split(",").includes("perf"), "no smoke + no vitals ⇒ no perf on PRs");
  assert.ok(full.engines.split(",").includes("perf"));
  assert.equal(full["security-sast"], "false");
  c.security.dast = false;
  assert.ok(!enginesCsv(c, "full").split(",").includes("security"));
});

test("GitLab config parses and installs what the runner needs", () => {
  const out = gitlabWorkflow(everything());
  const doc = yaml.load(out) as Record<string, { script?: string[] }>;
  const script = doc["verity:full"].script!.join("\n");
  assert.match(script, /k6-v0\.54\.0-linux-amd64/);
  assert.match(script, /docker-27\.3\.1\.tgz/);
  assert.match(script, /k6 --tier full --profile stress --vus 25 --duration 90s/);
  assert.match(script, /security-dast --tier full --depth baseline/);
  assert.match(doc["verity:fast"].script!.join("\n"), /git fetch --quiet origin main/);
  assert.match(out, /DOCKER_HOST: tcp:\/\/docker:2375/);
});

test("Jenkinsfile carries the same runner commands", () => {
  const out = jenkinsWorkflow(everything());
  assert.match(out, /node verity-engines\.mjs visual --tier full --snapshots-dir tests\/verity\/visual --max-diff-ratio 0\.01/);
  assert.match(out, /credentials\('VERITY_GRADER_API_KEY'\)/);
});
