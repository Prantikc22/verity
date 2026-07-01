# Verity

AI-augmented **Playwright test generation & execution** for development teams — a [QAShift](https://www.qashifthq.com) product.

Verity generates Playwright tests from a sentence or a URL, runs them in your **own CI**, uses an LLM to **self-heal** broken locators (surfaced as a suggested diff, never auto-merged), separates **flaky** from **broken**, and posts **predictions** about regression risk right inside your pull requests.

> Scope of this build: the **functional / UI testing** layer only. API testing (Schemathesis) and performance testing (Artillery/Locust) are separate future modules.

## The two execution tiers (the core honesty)

| | Quick check (`fast`) | Full regression (`full`) |
|---|---|---|
| What runs | Diff-aware subset mapped to changed files | The entire suite |
| When | Every PR commit | Merge / schedule / pre-deploy |
| Promise | A fast **sanity check** — *not* a regression guarantee | The actual **regression safety net** |
| Can block a merge | Never | Yes (Growth+ plans) |

These labels are enforced everywhere — UI, PR comments, CLI output, and the ingestion API.

## Predictions

- **GA** — Regression-prone module flagging · Flake vs. real-failure disambiguation
- **Beta** (labeled everywhere, hidden until enough history) — Cross-dimension risk correlation · Pre-merge deploy confidence score

No fabricated metrics: anything that can't be computed from real data shows an empty/loading state, never a placeholder number.

## Monorepo layout

```
apps/web              Next.js (App Router) — marketing, dashboard, API, predictions, trends   → Vercel
packages/core         @qashift/verity-core — MIT OSS engine: selection, flake, regression,
                      confidence, correlation, prompt builders (pure TS, no I/O)
packages/cli          @qashift/verity — CI runner: Playwright + reruns → ingestion API
packages/action       qashift/verity-action — GitHub Action wrapping the CLI
services/runner       Optional hosted execution worker (Fly.io) — opt-in only
```

## Stack

Next.js 16 + React 19 + TypeScript + Tailwind v4 + framer-motion (Vercel) · Supabase (Postgres + Auth, RLS) ·
Playwright · **pluggable OpenAI-compatible LLM** (OpenAI by default; swappable to DeepSeek / Qwen / OpenRouter
via `LLM_BASE_URL` + `LLM_MODEL`) · Upstash Redis + BullMQ (async jobs) · Resend (email) · PostHog (PLG funnel) ·
Razorpay (subscriptions, behind a `PaymentProvider` interface).

The LLM API key is **always** read from the environment (`LLM_API_KEY`) and never hardcoded.

## Local development

```bash
npm install
cp .env.example apps/web/.env.local   # fill in secrets (Supabase, LLM_API_KEY, …)
npm run dev                            # http://localhost:3000
```

## Predictions calibration thresholds

- Cross-dimension correlation: hidden until **20+ deploys** of history.
- Deploy confidence: hidden until **20+ deploys**; null with a reason otherwise.
- Regression flagging: a file is only flagged after **4+ recorded changes**.
