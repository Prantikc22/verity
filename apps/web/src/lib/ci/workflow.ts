/**
 * Pure CI-config generator for the "CI Setup" page. Given the engines a customer
 * picked + their per-discipline options, it emits ready-to-paste config for
 * GitHub Actions, GitLab CI, and Jenkins — plus a capability matrix describing
 * what each provider supports. No I/O; fully unit-testable; rendered live as the
 * user toggles options.
 *
 * Design: GitHub uses the first-party `qashift/verity-action`. GitLab/Jenkins
 * have no GitHub Action, so they fetch the SAME self-contained vendored runners
 * (verity.mjs / verity-engines.mjs) via curl — identical to the existing demo
 * pattern — so behavior matches without any extra package to publish.
 */

import type { PerfProfile } from "@qashift/verity-core";

export type EngineKey = "ui" | "apiFlow" | "contract" | "visual" | "agent" | "perf" | "security";
export type Provider = "github" | "gitlab" | "jenkins";
export type DastDepth = "baseline" | "full";

export interface CiConfig {
  engines: Record<EngineKey, boolean>;
  apiUrl: string;
  branch: string;
  perf: {
    smoke: boolean; // smoke profile on every PR (fast tier)
    fullLoad: boolean; // heavier profile on merge/schedule (full tier)
    profile: PerfProfile; // which profile runs on merge: load|stress|spike|soak|breakpoint
    arrivalRate: number; // peak VUs (concurrency) for the merge profile
    durationSec: number; // steady-phase duration (s)
    lighthouse: boolean; // Core Web Vitals
    lighthouseUrl: string;
  };
  security: {
    sast: boolean; // Semgrep
    dast: boolean; // ZAP
    dastTarget: string;
    dastDepth: DastDepth; // baseline (PR) vs full active scan
  };
  visual: {
    snapshotsDir: string; // where committed baseline screenshots live
    maxDiffPixelRatio: number; // allowed pixel drift before a snapshot is "changed"
  };
  agent: {
    endpoint: string; // the customer's AI feature endpoint under eval
    authTokenSecret: string; // name of the CI secret holding the endpoint token
  };
  contract: {
    openapiSpec: string;
    apiBaseUrl: string;
  };
}

export const DEFAULT_CONFIG: CiConfig = {
  engines: { ui: true, apiFlow: false, contract: false, visual: false, agent: false, perf: false, security: false },
  apiUrl: "https://verity-kappa-ebon.vercel.app",
  branch: "main",
  perf: { smoke: true, fullLoad: true, profile: "load", arrivalRate: 10, durationSec: 120, lighthouse: false, lighthouseUrl: "" },
  security: { sast: true, dast: false, dastTarget: "", dastDepth: "baseline", },
  visual: { snapshotsDir: "tests/verity/visual", maxDiffPixelRatio: 0.01 },
  agent: { endpoint: "", authTokenSecret: "AI_API_TOKEN" },
  contract: { openapiSpec: "openapi.yaml", apiBaseUrl: "" },
};

/** The comma-separated `engines` value the action/runner understands. */
export function enginesCsv(c: CiConfig): string {
  const list: string[] = [];
  if (c.engines.ui) list.push("ui");
  if (c.engines.apiFlow) list.push("api");
  if (c.engines.contract) list.push("contract");
  if (c.engines.visual) list.push("visual");
  if (c.engines.agent) list.push("agent");
  if (c.engines.perf) list.push("perf");
  if (c.engines.security) list.push("security");
  return list.join(",") || "ui";
}

export interface EngineMeta {
  key: EngineKey;
  label: string;
  tool: string;
  blurb: string;
  /** Whether the discipline needs Docker (Python tools). */
  docker: boolean;
}

export const ENGINES: EngineMeta[] = [
  { key: "ui", label: "UI tests", tool: "Playwright", blurb: "Browser end-to-end tests with self-healing + flake detection.", docker: false },
  { key: "apiFlow", label: "API journey tests", tool: "Playwright", blurb: "Example-based, flow-level API coverage from your OpenAPI spec.", docker: false },
  { key: "contract", label: "API contract tests", tool: "Contract checks", blurb: "Every operation exercised automatically — only the minimal failing case is reported.", docker: true },
  { key: "visual", label: "Visual tests", tool: "Screenshot regression", blurb: "Pixel-diff key screens against a committed baseline — catch unintended UI changes.", docker: false },
  { key: "agent", label: "Agent (AI) evals", tool: "LLM / agent evals", blurb: "Grounding, prompt-injection, tool-use & safety checks for your own AI features.", docker: false },
  { key: "perf", label: "Performance", tool: "Load + Core Web Vitals", blurb: "Smoke check on PRs, full load test on merge, page-load vitals.", docker: false },
  { key: "security", label: "Security", tool: "Dynamic + static scanning", blurb: "Scans your running app and your code — severity-ranked findings.", docker: true },
];

/* ---- capability matrix: what you get / what you don't, per provider ---- */
export interface Capability {
  feature: string;
  github: boolean | "partial";
  gitlab: boolean | "partial";
  jenkins: boolean | "partial";
  note?: string;
}

export const CAPABILITIES: Capability[] = [
  { feature: "Run any engine in your own CI", github: true, gitlab: true, jenkins: true },
  { feature: "One-line install (first-party Action)", github: true, gitlab: false, jenkins: false, note: "GitLab/Jenkins fetch the same vendored runner via curl." },
  { feature: "PR comment + Check Run (pass/fail, findings, perf)", github: true, gitlab: "partial", jenkins: "partial", note: "GitLab posts MR notes; Jenkins surfaces in build logs/links. The Verity dashboard always has full results." },
  { feature: "Merge-blocking on Full regression (Growth+)", github: true, gitlab: "partial", jenkins: "partial", note: "GitLab via pipeline rules; Jenkins via build status." },
  { feature: "Self-healing delivered as a PR/MR diff", github: true, gitlab: true, jenkins: "partial", note: "Jenkins needs a SCM token to open the PR." },
  { feature: "Diff-aware Quick check (changed files)", github: true, gitlab: true, jenkins: true },
  { feature: "Containerized security & contract scans", github: true, gitlab: true, jenkins: "partial", note: "Jenkins agent must allow containers." },
  { feature: "Visual baselines committed to your repo (unlimited snapshots)", github: true, gitlab: true, jenkins: true },
  { feature: "Agent/LLM evals against your AI endpoint", github: true, gitlab: true, jenkins: true, note: "Store the AI endpoint token as a CI secret." },
  { feature: "Dashboard: trends, predictions, API coverage, Security & Performance", github: true, gitlab: true, jenkins: true, note: "Every provider posts to the same ingestion API." },
];

const RAW = "https://raw.githubusercontent.com/qashift/verity-action/v1";

/* ---------------------------- GitHub Actions ---------------------------- */
function githubWith(c: CiConfig, tier: "fast" | "full"): string {
  const lines = [
    `    with:`,
    `      tier: ${tier}`,
    `      token: \${{ secrets.VERITY_INGEST_TOKEN }}`,
    `      engines: ${enginesCsv(c)}`,
  ];
  if (c.engines.visual) {
    lines.push(`      visual-snapshots-dir: ${c.visual.snapshotsDir}`);
    lines.push(`      visual-max-diff-ratio: "${c.visual.maxDiffPixelRatio}"`);
  }
  if (c.engines.agent && c.agent.endpoint) {
    lines.push(`      agent-endpoint: ${c.agent.endpoint}`);
    lines.push(`      agent-token: \${{ secrets.${c.agent.authTokenSecret} }}`);
  }
  if (c.engines.perf) {
    lines.push(`      perf-config: tests/verity/perf/verity.k6.js`);
    // fast tier ⇒ smoke; full tier ⇒ the chosen profile.
    if (tier === "full") lines.push(`      perf-profile: ${c.perf.profile}`);
    if (c.perf.lighthouse && c.perf.lighthouseUrl) lines.push(`      lighthouse-url: ${c.perf.lighthouseUrl}`);
  }
  if (c.engines.security && c.security.dast && c.security.dastTarget) {
    lines.push(`      security-target-url: ${c.security.dastTarget}`);
  }
  if (c.engines.contract) {
    lines.push(`      openapi-spec: ${c.contract.openapiSpec}`);
    lines.push(`      api-base-url: ${c.contract.apiBaseUrl || "https://staging.example.com"}`);
  }
  return lines.join("\n");
}

export function githubWorkflow(c: CiConfig): string {
  const needsNode = c.engines.ui || c.engines.apiFlow || c.engines.visual || c.engines.agent || c.engines.perf;
  const needsPlaywright = c.engines.ui || c.engines.apiFlow || c.engines.visual || c.engines.agent;
  const setup: string[] = [
    `      - uses: actions/checkout@v4`,
    `        with: { fetch-depth: 0 }   # diff-aware Quick check needs history`,
  ];
  if (needsNode) {
    setup.push(`      - uses: actions/setup-node@v4`, `        with: { node-version: "20" }`, `      - run: npm ci`);
  }
  if (needsPlaywright) {
    setup.push(`      - run: npx playwright install --with-deps chromium`);
  }
  return `# .github/workflows/verity.yml
name: Verity
on:
  pull_request:
  push:
    branches: [${c.branch}]
jobs:
  verity:
    runs-on: ubuntu-latest
    steps:
${setup.join("\n")}

      # ── Quick check / Perf smoke / baseline scans on every PR ──
      - name: Verity (fast)
        if: github.event_name == 'pull_request'
        uses: qashift/verity-action@v1
${githubWith(c, "fast")}

      # ── Full regression / load test / full scans on merge ──
      - name: Verity (full)
        if: github.ref == 'refs/heads/${c.branch}'
        uses: qashift/verity-action@v1
${githubWith(c, "full")}
`;
}

/* ------------------------------- GitLab CI ------------------------------ */
function runnerCmds(c: CiConfig, tier: "fast" | "full", indent: string): string[] {
  const out: string[] = [];
  const eng = enginesCsv(c);
  out.push(`${indent}export VERITY_API_URL="${c.apiUrl}"`);
  out.push(`${indent}curl -Ls ${RAW}/verity.mjs -o verity.mjs`);
  out.push(`${indent}curl -Ls ${RAW}/verity-engines.mjs -o verity-engines.mjs`);
  if (c.engines.ui || c.engines.apiFlow || c.engines.visual || c.engines.agent) {
    out.push(`${indent}npx playwright install --with-deps chromium`);
  }
  if (c.engines.ui || c.engines.apiFlow) {
    out.push(`${indent}node verity.mjs run --tier ${tier} --token "$VERITY_INGEST_TOKEN" --base origin/${c.branch}`);
  }
  // Each engine runs through the Verity runner, which drives the underlying
  // tooling internally — so your CI config never names a specific tool.
  if (c.engines.visual) {
    out.push(`${indent}node verity-engines.mjs visual --tier ${tier} --snapshots-dir ${c.visual.snapshotsDir}`);
  }
  if (c.engines.agent && c.agent.endpoint) {
    out.push(`${indent}node verity-engines.mjs agent --tier ${tier} --endpoint ${c.agent.endpoint}`);
  }
  if (c.engines.perf) {
    // Needs the k6 binary on the runner (https://k6.io/docs/get-started/installation).
    const prof = tier === "full" ? ` --profile ${c.perf.profile}` : "";
    const tgt = c.contract.apiBaseUrl ? ` --target ${c.contract.apiBaseUrl}` : "";
    out.push(`${indent}node verity-engines.mjs k6 --tier ${tier}${prof}${tgt}`);
    if (c.perf.lighthouse && c.perf.lighthouseUrl) {
      out.push(`${indent}node verity-engines.mjs cwv --tier ${tier} --target ${c.perf.lighthouseUrl}`);
    }
  }
  if (c.engines.security && c.security.sast) {
    out.push(`${indent}node verity-engines.mjs security-sast --tier ${tier} --base origin/${c.branch}`);
  }
  if (c.engines.security && c.security.dast && c.security.dastTarget) {
    out.push(`${indent}node verity-engines.mjs security-dast --tier ${tier} --target ${c.security.dastTarget}`);
  }
  if (c.engines.contract) {
    out.push(`${indent}node verity-engines.mjs contract --tier ${tier} --spec ${c.contract.openapiSpec} --target ${c.contract.apiBaseUrl || "https://staging.example.com"}`);
  }
  return out;
}

export function gitlabWorkflow(c: CiConfig): string {
  const img = "mcr.microsoft.com/playwright:v1.49.1-noble";
  const fast = runnerCmds(c, "fast", "    - ");
  const full = runnerCmds(c, "full", "    - ");
  return `# .gitlab-ci.yml  — store VERITY_INGEST_TOKEN as a masked CI/CD variable
stages: [verity]

verity:fast:
  stage: verity
  image: ${img}
  services: ["docker:dind"]
  rules: [{ if: '$CI_PIPELINE_SOURCE == "merge_request_event"' }]
  script:
${fast.join("\n")}

verity:full:
  stage: verity
  image: ${img}
  services: ["docker:dind"]
  rules: [{ if: '$CI_COMMIT_BRANCH == "${c.branch}"' }]
  script:
${full.join("\n")}
`;
}

/* ------------------------------- Jenkins -------------------------------- */
export function jenkinsWorkflow(c: CiConfig): string {
  const fast = runnerCmds(c, "fast", "          ").map((l) => l.trimStart());
  const full = runnerCmds(c, "full", "          ").map((l) => l.trimStart());
  const block = (cmds: string[]) => cmds.map((l) => `          ${l}`).join("\n");
  return `// Jenkinsfile — add VERITY_INGEST_TOKEN as a Jenkins credential (secret text)
pipeline {
  agent { docker { image 'mcr.microsoft.com/playwright:v1.49.1-noble'; args '-v /var/run/docker.sock:/var/run/docker.sock' } }
  environment { VERITY_INGEST_TOKEN = credentials('verity-ingest-token') }
  stages {
    stage('Verity — PR (fast)') {
      when { changeRequest() }
      steps {
        sh '''
${block(fast)}
        '''
      }
    }
    stage('Verity — ${c.branch} (full)') {
      when { branch '${c.branch}' }
      steps {
        sh '''
${block(full)}
        '''
      }
    }
  }
}
`;
}

export function workflowFor(provider: Provider, c: CiConfig): string {
  return provider === "github" ? githubWorkflow(c) : provider === "gitlab" ? gitlabWorkflow(c) : jenkinsWorkflow(c);
}

/** A short list of secrets the user must add, given their selection. */
export function requiredSecrets(c: CiConfig): { name: string; why: string }[] {
  const s = [{ name: "VERITY_INGEST_TOKEN", why: "Links runs to this project (from Settings)." }];
  if (c.engines.agent && c.agent.endpoint) s.push({ name: c.agent.authTokenSecret, why: "Auth token used to call your AI endpoint during evals." });
  return s;
}
