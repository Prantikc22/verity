/**
 * Landing-page FAQ. Plain data (no "use client") so the server page can emit the
 * same questions as FAQPage structured data that the client section renders.
 * Every answer must stay true to the product — it is shown to buyers and search.
 */
export const LANDING_FAQ = [
  {
    q: "What does Verity do?",
    a: "Verity is an AI test generator and verifier. Give it your app's URL (and optionally an OpenAPI spec or PRD) and it writes readable Playwright tests for UI and API flows, plus visual, AI-agent, performance and security checks. You review and commit them, your CI runs them on every pull request, and Verity turns the results into a release verdict with evidence.",
  },
  {
    q: "Where do the tests run?",
    a: "In your own CI — GitHub Actions, GitLab CI or Jenkins — with unlimited runs on every plan, including free. The CI Setup page generates the workflow file for you. Verity Cloud can also run a small number of tests in managed browsers so you can try it before wiring CI.",
  },
  {
    q: "Do I own the tests Verity writes?",
    a: "Yes. UI, API and visual tests are plain Playwright TypeScript in your repository, load tests are a script you commit, and AI-agent evals are a YAML file. Nothing is proprietary: if you stop using Verity, the tests keep running.",
  },
  {
    q: "Does my source code leave my infrastructure?",
    a: "Not when you run on CI. Tests and scans execute on your own runners, and only results — pass/fail, timings, error messages and findings — are posted back to Verity. To write tests, Verity reads your live app in a browser, plus any spec or PRD you choose to upload.",
  },
  {
    q: "How does Verity tell a flaky test from a real failure?",
    a: "Failing tests are rerun automatically. A test that passes on retry is marked flaky and tracked over time; one that fails every time is a real failure. On plans with merge gating, only real failures on the Full regression run can block a merge — the Quick check on pull requests never does.",
  },
  {
    q: "What happens when my UI changes?",
    a: "On paid plans, Verity proposes the smallest selector repair grounded in the live page, reruns it, and hands it to you as a reviewable diff. It never edits your code on its own, and genuine product bugs stay failures instead of being healed away.",
  },
  {
    q: "How much does Verity cost?",
    a: "Free covers one project with 15 AI-written tests a month — of every type — plus unlimited CI runs, no credit card. Pro is $49 a month (200 tests, self-healing, pull-request checks) and Team is $149. You never pay for runs in your own CI. QAShift also offers managed testing with a dedicated engineer from $499 a month.",
  },
] as const;
