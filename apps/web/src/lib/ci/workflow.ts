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

export type EngineKey = "ui" | "apiFlow" | "contract" | "mobile" | "perf" | "security";
export type Provider = "github" | "gitlab" | "jenkins";
export type DastDepth = "baseline" | "full";
export type MobilePlatform = "android" | "ios";

export interface CiConfig {
  engines: Record<EngineKey, boolean>;
  apiUrl: string;
  branch: string;
  perf: {
    smoke: boolean; // Perf smoke check on every PR
    fullLoad: boolean; // full load test on merge/schedule
    arrivalRate: number; // VUs/sec for the full load test
    durationSec: number;
    rampTo?: number;
    distributed: boolean; // Artillery distributed/serverless
    lighthouse: boolean; // Core Web Vitals
    lighthouseUrl: string;
  };
  security: {
    sast: boolean; // Semgrep
    dast: boolean; // ZAP
    dastTarget: string;
    dastDepth: DastDepth; // baseline (PR) vs full active scan
  };
  mobile: {
    platform: MobilePlatform;
    flowsDir: string;
    realDevice: boolean;
  };
  contract: {
    openapiSpec: string;
    apiBaseUrl: string;
  };
}

export const DEFAULT_CONFIG: CiConfig = {
  engines: { ui: true, apiFlow: false, contract: false, mobile: false, perf: false, security: false },
  apiUrl: "https://verity-kappa-ebon.vercel.app",
  branch: "main",
  perf: { smoke: true, fullLoad: true, arrivalRate: 10, durationSec: 120, rampTo: undefined, distributed: false, lighthouse: false, lighthouseUrl: "" },
  security: { sast: true, dast: false, dastTarget: "", dastDepth: "baseline", },
  mobile: { platform: "android", flowsDir: "tests/verity/mobile", realDevice: false },
  contract: { openapiSpec: "openapi.yaml", apiBaseUrl: "" },
};

/** The comma-separated `engines` value the action/runner understands. */
export function enginesCsv(c: CiConfig): string {
  const list: string[] = [];
  if (c.engines.ui) list.push("ui");
  if (c.engines.apiFlow) list.push("api");
  if (c.engines.contract) list.push("contract");
  if (c.engines.mobile) list.push("mobile");
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
  { key: "mobile", label: "Mobile tests", tool: "Mobile app flows", blurb: "Native app flows on an emulator/simulator (or real devices).", docker: false },
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
  { feature: "Android emulator / iOS simulator for mobile", github: true, gitlab: "partial", jenkins: "partial", note: "You provision the emulator on your runner; macOS needed for iOS." },
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
  if (c.engines.mobile) {
    lines.push(`      maestro-flows-dir: ${c.mobile.flowsDir}`);
    if (c.mobile.realDevice) {
      lines.push(`      maestro-real-device: "true"`);
      lines.push(`      maestro-cloud-api-key: \${{ secrets.MAESTRO_CLOUD_API_KEY }}`);
    }
  }
  if (c.engines.perf) {
    lines.push(`      perf-config: tests/verity/perf/${tier === "fast" ? "smoke" : "load"}.yml`);
    if (tier === "full" && c.perf.distributed) lines.push(`      perf-distributed: "true"`);
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
  const needsNode = c.engines.ui || c.engines.apiFlow || c.engines.perf;
  const setup: string[] = [
    `      - uses: actions/checkout@v4`,
    `        with: { fetch-depth: 0 }   # diff-aware Quick check needs history`,
  ];
  if (needsNode) {
    setup.push(`      - uses: actions/setup-node@v4`, `        with: { node-version: "20" }`, `      - run: npm ci`);
  }
  if (c.engines.ui || c.engines.apiFlow) {
    setup.push(`      - run: npx playwright install --with-deps chromium`);
  }
  if (c.engines.mobile) {
    setup.push(
      `      # Mobile: provision an emulator + the mobile test driver (cost is yours).`,
      `      - run: curl -Ls "https://get.maestro.mobile.dev" | bash`,
      `      - uses: reactivecircus/android-emulator-runner@v2`,
      `        with: { api-level: 34, script: echo ready }`,
    );
  }
  return `# .github/workflows/verity.yml
name: Verity
on:
  pull_request:
  push:
    branches: [${c.branch}]
jobs:
  verity:
    runs-on: ${c.engines.mobile && c.mobile.platform === "ios" ? "macos-latest" : "ubuntu-latest"}
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
  if (c.engines.ui || c.engines.apiFlow) {
    out.push(`${indent}npx playwright install --with-deps chromium`);
    out.push(`${indent}node verity.mjs run --tier ${tier} --token "$VERITY_INGEST_TOKEN" --base origin/${c.branch}`);
  }
  // Each engine runs through the Verity runner, which drives the underlying
  // tooling internally — so your CI config never names a specific tool.
  if (c.engines.mobile) {
    out.push(`${indent}node verity-engines.mjs mobile --tier ${tier} --flows-dir ${c.mobile.flowsDir}`);
  }
  if (c.engines.perf) {
    out.push(`${indent}node verity-engines.mjs perf --tier ${tier}`);
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
  if (c.engines.mobile && c.mobile.realDevice) s.push({ name: "MAESTRO_CLOUD_API_KEY", why: "Real-device runs via Maestro Cloud." });
  return s;
}
