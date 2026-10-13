# qashift/verity-action

GitHub Action that runs your Playwright suite and reports results to [Verity](https://verity-kappa-ebon.vercel.app) — AI-augmented testing by QAShift.

The runner is **self-contained** (vendored in this action), so there's nothing to `npm install` and no package to publish — just Node 20+ (default on `ubuntu-latest`) and a Playwright install in your workflow.

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }          # needed for diff-aware Quick check
- uses: actions/setup-node@v4
  with: { node-version: "20" }
- run: npm install
- run: npx playwright install --with-deps chromium

# Quick check (diff-aware) on PRs — a fast sanity check, never blocks.
- uses: qashift/verity-action@v1
  with:
    tier: fast
    token: ${{ secrets.VERITY_INGEST_TOKEN }}

# Full regression on merge to main — the safety net.
- uses: qashift/verity-action@v1
  if: github.ref == 'refs/heads/main'
  with:
    tier: full
    token: ${{ secrets.VERITY_INGEST_TOKEN }}
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `tier` | `fast` | `fast` = Quick check / smoke (diff-aware). `full` = Full regression / load. |
| `token` | — | Your project's Verity ingest token (store as a secret). **Required.** |
| `base` | `origin/main` | Base ref for diff-aware selection on the fast tier. |
| `api-url` | Verity cloud | Override the Verity API base URL (self-hosted). |
| `engines` | `ui` | Comma-separated engines to run: `ui,api,visual,agent,perf,security,contract`. |

The default (`engines: ui`) keeps existing behavior exactly. Add engines to enable the additive disciplines below. **Every engine runs in YOUR CI — the cost is yours — and all results post through the same Verity ingestion API.** Each discipline maps its native tool output into Verity's unified results schema via a small adapter, so nothing about the existing UI/API flow changes.

---

## Multi-discipline testing

### 🖼️ Visual (screenshot regression)

Runs AI-generated **Playwright visual specs** (in `tests/verity/visual/`) whose assertion is `toHaveScreenshot`. Each spec navigates to a stable UI state, masks volatile regions, and diffs a screenshot against the **baseline committed in your repo**. A diff over the threshold is reported as a *changed* snapshot; you approve the new baseline or fix the regression.

```yaml
- uses: qashift/verity-action@v1
  with:
    token: ${{ secrets.VERITY_INGEST_TOKEN }}
    engines: ui,visual
    visual-snapshots-dir: tests/verity/visual
    visual-max-diff-ratio: "0.01"
```

Because baselines live in your repo and run in your CI, visual coverage is unlimited. Self-healing applies as with UI specs — a broken navigation locator is repaired from the live DOM and delivered as a PR diff.

| Input | Default | Description |
|---|---|---|
| `visual-snapshots-dir` | `tests/verity/visual` | Directory of Playwright visual specs + committed baselines. |
| `visual-max-diff-ratio` | `0.01` | Allowed pixel drift (0–1) before a snapshot counts as changed. |

### 🤖 Agent (AI-feature evals)

Runs AI-generated evals against the HTTP endpoint behind your **own** AI feature (a chatbot, RAG assistant, or tool-using agent). Each eval asserts a *property* of the reply — grounding (no hallucination), prompt-injection resistance, correct tool-use, safety/PII, valid format, or clean refusal — never an exact string, since model output varies. Two formats, both optional and merged into one agent run:

- **Scored eval suite** — `tests/verity/agent/verity.evals.yaml`. A built-in adversarial pack (prompt injection via direct, pasted-data, role-play and encoded instructions; PII echo) plus cases written for your feature. On Full regression each case is asked **3×**, so an inconsistent answer shows as flaky rather than hiding behind one lucky run. Rubric (AI-graded) checks need `grader-api-key`; without it the run stops instead of passing silently.
- **Playwright API evals** — `tests/verity/agent/*.spec.ts`, for exact code-level checks (tool calls, JSON schemas).

If the endpoint never replies (down, 401/403/404) the run fails with the reason instead of reporting a verdict on the model.

```yaml
- uses: qashift/verity-action@v1
  with:
    token: ${{ secrets.VERITY_INGEST_TOKEN }}
    engines: agent
    agent-endpoint: https://api.example.com/chat
    agent-token: ${{ secrets.AI_API_TOKEN }}
```

> **Constraint:** evals need a **reachable endpoint**. For internal/firewalled AI endpoints this only runs inside your own CI. Store the endpoint's auth token as a CI secret — never in the config.

| Input | Default | Description |
|---|---|---|
| `agent-endpoint` | — | Reachable HTTP endpoint of your AI feature. |
| `agent-token` | — | Secret token used to authenticate eval calls to the endpoint (exposed to evals as `AI_API_TOKEN`). |
| `grader-api-key` | — | Key for AI-graded suite checks (any OpenAI-compatible provider). |
| `grader-base-url` | OpenAI | Base URL of an OpenAI-compatible grader API. |
| `grader-model` | `gpt-4o-mini` | Model that grades rubric checks. |

> **Mobile app testing** is available as a **human-run (non-AI) service** through QAShift — the Verity AI agent does not author mobile flows, because it cannot reach a device/emulator the way it reaches a URL or an API. Talk to us if you need native mobile coverage.

### ⚡ Performance (k6 + Lighthouse)

AI-generated k6 scripts can exercise the **same API base URL** used by your API tests — no second upload. Two tiers mirror Quick check / Full regression:

- **fast** → a lightweight **Perf smoke check** on every PR (few endpoints, ~30s, small VU count). Always labeled "Perf smoke check" — never implied to be a full load test.
- **full** → the complete, customer-configured load test on merge/schedule.

For distributed load, run the generated k6 script in your own k6/Grafana execution environment. Optionally set `lighthouse-url` for a separate, lightweight Core Web Vitals check.

| Input | Default | Description |
|---|---|---|
| `perf-config` | `tests/verity/perf/verity.k6.js` | k6 script to run. |
| `lighthouse-url` | — | If set, also run Lighthouse CI for Core Web Vitals. |

### 🔐 Security (ZAP DAST + Semgrep SAST)

Both run as **Docker-based steps** (the official images carry their own Python runtime — you never install Python locally):

- **Semgrep (SAST)** — Community Edition, invoked CLI-only via Docker (never linked into our code). Diff of changed files on PR; full repo on schedule.
- **ZAP (DAST)** — baseline scan on PR, full active scan on merge, against `security-target-url` (a reachable preview/staging URL).

Findings are surfaced as severity-ranked **Security issues** in the dashboard — not pass/fail tests — and never block the build.

| Input | Default | Description |
|---|---|---|
| `security-target-url` | — | Reachable preview/staging URL for the ZAP DAST scan. |

### 🔁 API contract (Schemathesis)

A second, independent contract-testing layer **alongside** the existing Playwright-request flow tests (which are unchanged). Runs as a Docker step against the **same** OpenAPI spec + base URL you already provided:

```yaml
  with:
    engines: api,contract
    openapi-spec: openapi.yaml
    api-base-url: https://staging.example.com
```

> **Constraint:** Schemathesis needs a **reachable base URL** to execute (not just the spec). For public APIs, Verity can do an optional Cloud Trial demo run before CI is wired. For **internal/firewalled APIs this only runs inside your own CI** — there is no way for Verity's cloud to reach a private host.

Only the final **shrunk** failures are reported (Schemathesis minimizes each failure to a minimal reproducing example). In the dashboard, API results are grouped by endpoint then meaning and labeled **Flow** vs **Contract** — never by tool name — and a flow + contract failure with the same underlying cause collapses into one entry tagged as found by both.

| Input | Default | Description |
|---|---|---|
| `openapi-spec` | — | Path/URL to the OpenAPI spec (reused for contract + perf). |
| `api-base-url` | — | Reachable base URL of the API under test. |

---

## Licenses (engines)

All bundled engines are invoked as external CLIs/Docker images or as separate npm tools — **never linked into Verity's own code** — so no copyleft obligation attaches to Verity:

| Engine | License | Notes |
|---|---|---|
| Playwright (UI + visual) | Apache-2.0 | Clean. Visual = built-in `toHaveScreenshot`; no extra dep. |
| k6 | AGPL-3.0 | Invoked as an external CLI; not linked into Verity. |
| OWASP ZAP | Apache-2.0 | Clean. Run via Docker. |
| Semgrep CE | LGPL-2.1 | Clean under **subprocess/Docker-only** use — never imported or linked. |
| Schemathesis | **MIT** | Verified in its repo. Most permissive; Docker subprocess invocation. |
| Lighthouse | Apache-2.0 | Clean. |

MIT licensed.
