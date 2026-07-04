import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { DocsNav, type DocSection } from "./DocsNav";

export const metadata: Metadata = {
  title: "Docs",
  description: "Wire Verity into your CI — UI, API, visual, agent (AI), performance, and security testing across GitHub, GitLab, and Jenkins.",
};

const SECTIONS: DocSection[] = [
  { id: "overview", label: "Overview", group: "Start" },
  { id: "quickstart", label: "Quickstart", group: "Start" },
  { id: "choose-engines", label: "Choosing tests", group: "Start" },
  { id: "github", label: "GitHub Actions", group: "CI providers" },
  { id: "gitlab", label: "GitLab CI", group: "CI providers" },
  { id: "jenkins", label: "Jenkins", group: "CI providers" },
  { id: "cli", label: "CLI", group: "CI providers" },
  { id: "ui", label: "UI testing", group: "Disciplines" },
  { id: "api", label: "API testing", group: "Disciplines" },
  { id: "visual", label: "Visual", group: "Disciplines" },
  { id: "agent", label: "Agent (AI)", group: "Disciplines" },
  { id: "performance", label: "Performance", group: "Disciplines" },
  { id: "security", label: "Security", group: "Disciplines" },
  { id: "self-healing", label: "Self-healing", group: "How it works" },
  { id: "predictions", label: "Predictions", group: "How it works" },
  { id: "ingestion", label: "Ingestion API", group: "How it works" },
  { id: "team", label: "Roles & team", group: "Account" },
  { id: "cloud-trial", label: "Cloud Sandbox", group: "Account" },
  { id: "licenses", label: "Licenses & OSS", group: "Account" },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto border border-neutral-200 bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-300 dark:border-neutral-800">
      <code>{children}</code>
    </pre>
  );
}
function H({ id, n, children }: { id: string; n: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-24 text-xl font-semibold tracking-tight">{n ? <span className="text-neutral-400">{n} · </span> : null}{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{children}</p>;
}

export default function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-[200px_1fr]">
        {/* Left TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <DocsNav sections={SECTIONS} />
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 max-w-2xl space-y-14">
          <section>
            <H id="overview" n="">Verity docs</H>
            <P>Verity is <strong>CI-native</strong>: every test runs in <em>your</em> pipeline and posts results to Verity&apos;s ingestion API. One platform covers UI, API, visual, agent (AI), performance, and security — each an additive engine you can turn on independently. We never host your browsers for paid usage, and never receive your secrets.</P>
            <P>The fastest path: open <Link href="/dashboard" className="text-indigo-600 underline">the dashboard</Link> → a project → <strong>CI Setup</strong>, toggle the tests you want, and copy the generated config for your provider.</P>
          </section>

          <section>
            <H id="quickstart" n="1">Quickstart</H>
            <P>Create a project in the dashboard and copy its ingest token into your CI secrets as <code>VERITY_INGEST_TOKEN</code>. Then add the config from <strong>CI Setup</strong> (it&apos;s generated for your exact selection). That&apos;s it — PRs get a fast Quick check, merges get the Full regression.</P>
          </section>

          <section>
            <H id="choose-engines" n="2">Choosing which tests to run</H>
            <P>You don&apos;t need all engines. In CI Setup, toggle any of: <code>ui</code>, <code>api</code> (flow), <code>contract</code>, <code>visual</code>, <code>agent</code>, <code>perf</code>, <code>security</code>. The <code>engines</code> input controls which steps run; the default <code>ui</code> keeps the classic behavior. Every engine maps its native output into one unified results schema, so the dashboard, PR comments, and predictions work the same regardless of what you enable.</P>
          </section>

          <section>
            <H id="github" n="3">GitHub Actions</H>
            <P>The first-party Action wraps everything. CI Setup generates this for your selection:</P>
            <Code>{`# .github/workflows/verity.yml
- uses: qashift/verity-action@v1
  with:
    tier: fast            # 'fast' on PRs, 'full' on merge
    token: \${{ secrets.VERITY_INGEST_TOKEN }}
    engines: ui,api,perf,security   # pick what you need`}</Code>
          </section>

          <section>
            <H id="gitlab" n="4">GitLab CI</H>
            <P>No GitHub Action needed — GitLab fetches the same self-contained runners via <code>curl</code> and reports to the same dashboard. Store <code>VERITY_INGEST_TOKEN</code> as a masked CI/CD variable. CI Setup generates the full <code>.gitlab-ci.yml</code>; the core is:</P>
            <Code>{`verity:fast:
  image: mcr.microsoft.com/playwright:v1.49.1-noble
  services: ["docker:dind"]
  script:
    - curl -Ls https://raw.githubusercontent.com/qashift/verity-action/v1/verity.mjs -o verity.mjs
    - curl -Ls https://raw.githubusercontent.com/qashift/verity-action/v1/verity-engines.mjs -o verity-engines.mjs
    - node verity.mjs run --tier fast --token "$VERITY_INGEST_TOKEN"`}</Code>
          </section>

          <section>
            <H id="jenkins" n="5">Jenkins</H>
            <P>Same approach via a Docker agent. Add <code>VERITY_INGEST_TOKEN</code> as a Jenkins credential (secret text); the agent needs <code>docker run</code> for the security/contract steps. CI Setup generates the full <code>Jenkinsfile</code>.</P>
          </section>

          <section>
            <H id="cli" n="5b">CLI</H>
            <P>Prefer not to use a CI integration? The CLI runs the same pipeline from any shell. Install it, then run the tier you want — it reruns failures to separate flaky from broken and posts results to Verity.</P>
            <Code>{`npm i -D @qashifthq/verity

# Quick check — diff-aware subset (fast, every PR)
npx verity run --tier fast --token $VERITY_INGEST_TOKEN

# Full regression — the entire suite (on merge)
npx verity run --tier full --token $VERITY_INGEST_TOKEN`}</Code>
            <P>There&apos;s also a local <strong>MCP</strong> server (<code>@qashifthq/verity-mcp</code>) so an AI IDE can propose, generate, and run tests in your repo. See the <strong>Local / MCP</strong> tab in your project.</P>
          </section>

          <section>
            <H id="ui" n="6">UI testing (Playwright)</H>
            <P>AI-generated Playwright specs with grounded locators, run in your CI. Failures are rerun to separate <em>flaky</em> from <em>broken</em>; broken locators are self-healed (below). The fast tier is a diff-aware <strong>Quick check</strong>; only the <strong>Full regression</strong> tier can block a merge.</P>
            <P><strong>Verified generation:</strong> on the Tests page, <em>Verify drafts</em> runs newly generated specs in a real cloud browser and self-heals any failure before you trust them — each test is badged <span className="text-emerald-600">Verified ✓</span> (it actually passed) or <em>Needs review</em>. Verification is part of authoring: it consumes no cloud-run quota.</P>
          </section>

          <section>
            <H id="api" n="7">API testing</H>
            <P>Verity tests each endpoint two complementary ways and merges them so you see API health, not tooling:</P>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
              <li><strong>Example journeys</strong> — Playwright request tests for real flows (create → read → update), generated from your OpenAPI spec.</li>
              <li><strong>Contract checks</strong> — Verity exercises every operation with automatically generated inputs and reports only the minimal reproducing failure.</li>
            </ul>
            <P>The dashboard groups results by endpoint; a failure both methods catch is shown once and marked double-verified. Contract testing needs a reachable base URL — for internal APIs it runs only inside your CI.</P>
          </section>

          <section>
            <H id="visual" n="8">Visual</H>
            <P>AI-generated Playwright visual specs in <code>tests/verity/visual/</code> whose assertion is <code>toHaveScreenshot</code>. Each spec navigates to a stable UI state, masks volatile regions (timestamps, avatars, ads), and diffs a screenshot against the <strong>baseline committed in your repo</strong>. A diff over your <code>maxDiffPixelRatio</code> is reported as a <em>changed</em> snapshot — you approve the new baseline or fix the regression. Because baselines live in your repo and run in your CI, visual coverage is unlimited, and broken navigation locators self-heal exactly as UI specs do.</P>
          </section>

          <section>
            <H id="agent" n="9">Agent (AI)</H>
            <P>Evals for your <strong>own</strong> AI features — chatbots, RAG assistants, and tool-using agents. AI-generated Playwright API tests in <code>tests/verity/agent/</code> POST to your AI endpoint and assert a <em>property</em> of the reply, never an exact string (model output varies): grounding (no hallucination), prompt-injection resistance, correct tool-use, safety/PII, valid format, or clean refusal. Point Verity at the endpoint and store its token as a CI secret; evals run on every deploy so a prompt change or model swap can&apos;t quietly break behavior. Needs a reachable endpoint — for internal AI endpoints it runs only inside your CI.</P>
            <div className="mt-3 border border-neutral-100 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
              <p className="font-medium">Mobile app testing</p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">Native mobile coverage is available as a <strong>human-run (non-AI) service</strong> through QAShift — the Verity AI agent doesn&apos;t author mobile flows, because it can&apos;t reach a device or emulator the way it reaches a URL or an API. <a href="https://qashifthq.com/contact" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Talk to us</a> if you need it.</p>
            </div>
          </section>

          <section>
            <H id="performance" n="10">Performance</H>
            <P><strong>Verity&apos;s performance engine is a load test for your API</strong>, not a website crawler. It generates concurrent traffic against the endpoints/flows Verity builds from your OpenAPI spec and measures latency percentiles (p50/p95/p99) and error rate under load — it does smoke, soak, and spike by shaping <em>phases</em>. For page-load performance, enable <strong>Core Web Vitals</strong> (the front-end half).</P>
            <div className="mt-3 border border-neutral-100 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
              <p className="font-medium">Key terms</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-600 dark:text-neutral-400">
                <li><strong>VU (virtual user)</strong> — one simulated user running a scenario.</li>
                <li><strong>arrivalRate</strong> — new VUs started per second; your load knob.</li>
                <li><strong>ramp</strong> — increase arrivalRate over time to find the breaking point.</li>
                <li><strong>p95</strong> — watch this, not the average; it reflects your slowest real users.</li>
              </ul>
            </div>
            <P><strong>Optimal config:</strong> smoke (every PR) stays tiny (arrivalRate 1–2, ~30s) — it catches “this PR made the API slower,” never capacity. Full load (merge) should start near real peak traffic and ramp; healthy = error rate &lt; 1% and a stable p95 as load rises. One CI runner caps at a few hundred req/s — use distributed mode for more.</P>
          </section>

          <section>
            <H id="security" n="11">Security</H>
            <P><strong>Dynamic analysis</strong> scans your running app at a URL — baseline on PRs, full active scan on merge. <strong>Static analysis</strong> scans your code (diff on PRs, full repo on schedule) in an isolated container. Findings are surfaced as severity-ranked <em>issues</em>, not pass/fail tests, and never block the build.</P>
            <P><strong>How to read them:</strong> work top-down — fix Critical/High before release, schedule Medium, batch Low/Info. SAST points at a <code>file:line</code> (precise — fix at source); DAST points at a URL (baseline can be noisy — confirm first). Follow the CWE link for the bug class and standard fix; a finding that disappears next scan is resolved.</P>
          </section>

          <section>
            <H id="self-healing" n="12">Self-healing</H>
            <P>When a locator breaks, Verity sends the old selector + surrounding DOM context to the healing model, which proposes a corrected locator. It is <strong>never</strong> written into your source automatically — you review and apply the diff (or merge the PR). One delivery path for every discipline.</P>
          </section>

          <section>
            <H id="predictions" n="13">Predictions</H>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
              <li><strong>Regression-prone module flagging</strong> <em>(Live)</em> — high-regression-rate files are flagged in PR comments.</li>
              <li><strong>Flake vs. real-failure disambiguation</strong> <em>(Live)</em> — each failure shows its historical flake rate.</li>
              <li><strong>Risk correlation &amp; deploy confidence</strong> <em>(Calibrating)</em> — switch on after ~20 deploys of history.</li>
            </ul>
          </section>

          <section>
            <H id="ingestion" n="14">Ingestion API</H>
            <P>The Action, CLI, and engine adapters all call this. The contract is stable; new disciplines use additive optional fields (<code>findings</code>, <code>perf</code>, per-result <code>discipline</code>/<code>layer</code>).</P>
            <Code>{`POST /api/ingest
Authorization: Bearer $VERITY_INGEST_TOKEN

{
  "tier": "fast",
  "commit_sha": "abc123",
  "branch": "feature/x",
  "results": [
    { "spec_path": "tests/checkout.spec.ts", "attempts": [false, true, true] }
  ]
  // security runs add "findings": [...]; performance adds "perf": {...}
}`}</Code>
            <P><code>attempts</code> is the per-rerun pass/fail array: mixed = flaky, all-false = real failure, all-true = pass.</P>
          </section>

          <section>
            <H id="team" n="15">Roles &amp; team</H>
            <P>Invite teammates from <Link href="/dashboard/team" className="text-indigo-600 underline">Team</Link> (they must have a Verity account first). Three roles:</P>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
              <li><strong>Owner</strong> — full control + billing. One per org.</li>
              <li><strong>Admin</strong> — manage projects, members, and CI.</li>
              <li><strong>Member</strong> — read-only access to projects, tests, runs, and all dashboards.</li>
            </ul>
            <P>Access is enforced by row-level security: members only ever see their own org&apos;s data.</P>
          </section>

          <section>
            <H id="cloud-trial" n="16">Cloud Sandbox</H>
            <P>To get the feel without wiring CI, generation and a capped number of runs execute on our infra. It&apos;s intentionally limited — the product lives in your CI, where runs are unlimited.</P>
          </section>

          <section>
            <H id="licenses" n="17">Licenses &amp; open source</H>
            <P>The core engine (<code>@qashift/verity-core</code>) is MIT-licensed. Every test engine Verity drives is best-in-class open source, invoked in isolation (never linked into our code), so you own the test files outright and there&apos;s no lock-in. The hosted dashboard, predictions, and team management are proprietary.</P>
          </section>
        </main>
      </div>
    </div>
  );
}
