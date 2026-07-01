# Verity — project guide for Claude Code

Verity is an **AI-augmented, multi-discipline testing platform** (a QAShift product). AI generates tests, an engineer verifies, and everything runs in the **customer's own CI** ("Path B"), posting results to Verity's ingestion API. The dashboard authors/analyzes; CI executes.

> This file is the source of truth for a fresh Claude Code session. Read it before making changes. The project is **not a git repo** — there is no history; be careful.

## Stack & layout (npm workspaces monorepo, Node ≥20)

- `apps/web` — **Next.js 16 + React 19 + Tailwind v4 + framer-motion**. The landing page, dashboard, and all API routes. This is the deployed app. Brand accent = indigo/violet.
- `packages/core` (`@qashift/verity-core`) — pure-TS engine: types, flake/regression/confidence math, prompt builders, `hardenSpec`, and the **multi-discipline result adapters** (`adapters.ts`, `disciplines.ts`). **Consumed directly from `./src` (no build step)** — edit and it's picked up.
- `packages/action` — the vendored CI runner: `verity.mjs` (Playwright UI/API) + `verity-engines.mjs` (mobile/perf/security/contract; self-runs each tool). Mirror of the `qashift/verity-action` GitHub repo. **Self-contained plain JS, no deps.**
- `packages/cli` (`@qashifthq/verity`, published) and `packages/mcp` (`@qashifthq/verity-mcp`, published) — CLI + local MCP server.
- `services/runner` — the Fly.io cloud runner (real Playwright) for capped cloud runs.
- `examples/localhost-app` — tiny static app + Playwright specs for testing the runner/MCP locally (`npm start` → :3000).
- `supabase/migrations/*.sql` — DB migrations (reviewable; applied to live via the Supabase MCP, not `supabase db push` here).

## Commands

```bash
npm install                        # once, on a fresh checkout
npm run dev                        # apps/web dev server
npm run build                      # core typecheck + apps/web production build
cd apps/web && npx tsc --noEmit    # typecheck web only (fast)
cd packages/core && npm test       # core unit tests (node --test + tsx)
npx vercel deploy --prod --yes     # DEPLOY (from repo root; needs `vercel login` first)
```

Always run `npx tsc --noEmit` (web) and `npm test` (core) before deploying. `next build` catches RSC/client-boundary issues.

## How it works (the model)

- **Two-tier honesty:** `fast` = "Quick check" (diff-aware subset, never blocks) · `full` = "Full regression" (whole suite, only tier that can block a merge). Perf uses "Perf smoke check" vs "Full load test".
- **Disciplines:** UI + API (Playwright) are the originals; **mobile** (Maestro), **performance** (Artillery + Core Web Vitals), **security** (dynamic + static scanning), and **API contract** (Schemathesis) are additive. Every engine maps its native output into ONE unified results schema via a pure adapter in `packages/core/src/adapters.ts`, then posts through the EXISTING `/api/ingest` (additive optional fields: `discipline`, `findings[]`, `perf`, per-result `layer`/`endpoint`/`meaning`). **Never change the ingestion API's external contract — only add.**
- **CI Setup page** (`/dashboard/projects/[id]/ci`) is a **config GENERATOR**, not a live switch. Toggling engines regenerates the GitHub/GitLab/Jenkins config; the customer must **commit it to their repo's workflow** to actually run. The runner names no tool in the generated config (it self-runs them).
- **Ingestion** (`apps/web/src/lib/ingest.ts` `recordRun`): classifies flake vs real failure, rolls up flake/regression stats, persists findings/perf, writes each deploy's full-run signal onto `deploys` (for predictions), and **prunes to the last 30 runs/project** (aggregate stats are never pruned).
- **Predictions** read preserved aggregates (`flake_stats`, `regression_stats`, `deploys.full_*`) — robust to the run prune. Beta predictions gate on 20+ deploys of history.
- **Self-healing** is one PR-diff path for all disciplines (DOM for web, accessibility tree for mobile). Never writes source automatically.
- **LLM** is a pluggable OpenAI-compatible provider (`apps/web/src/lib/llm/provider.ts`); key ALWAYS from `LLM_API_KEY`, model/base overridable.
- **No customer-facing tool names.** Only **Playwright** may be named (the "you own the code" claim). Everything else uses capability language (load test, dynamic/static scanning, contract checks, Core Web Vitals, mobile app flows).

## Live infrastructure (already provisioned)

- **Supabase** project `Verity`, ref `ouwxurpwdxumuvgyuzip`, region ap-southeast-1. Schema via `supabase/migrations`; RLS via `is_org_member`/`is_org_admin`. `database.types.ts` is **hand-maintained** — update it when you add columns.
- **Vercel** project `verity` (team `cprantik22-4193`), prod alias **https://verity-kappa-ebon.vercel.app**. Deploy with `npx vercel deploy --prod` (NOT git-push — this folder isn't git).
- **Fly.io** `verity-runner` (https://verity-runner.fly.dev), scale-to-zero, real Playwright.
- **GitHub App** "Verity by QAShift" (App ID 4084759). Repos under the `qashift` org: `qashift/verity-action` (Action, tag `@v1`) and `qashift/verity-demo` (sample). **The Verity app itself is NOT on GitHub.**
- **npm:** `@qashifthq/verity` (CLI), `@qashifthq/verity-mcp` — published; `@qashift/verity-core` — workspace-only.

## Secrets

All in **`apps/web/.env.local`** (gitignored, NOT recreatable): Supabase URL + anon + service_role key, `LLM_API_KEY`, GitHub App id/client/webhook secret/private key (B64), `RUNNER_SERVICE_TOKEN`, project ingest token, etc. See `.env.example` for the full list of names.

## Deploy boundaries (important)

- **Deploy/push Verity freely** (Vercel `verity`, and the `qashift/*` GitHub repos with a provided token).
- **Do NOT push or deploy the QAShift marketing site** (`qashifthq.com`, a separate repo under a **different GitHub account**). Make local edits only; the user pushes it.

## Conventions

- Match the existing flat, indigo-accented Tailwind aesthetic. Reuse `.v-card` (hover lift) + `.tnum` (tabular numbers) from `globals.css`.
- Additive over breaking: never alter the ingestion contract, the existing UI/API PR-comment format, or existing Playwright UI/API generation. New work = additive modules following established patterns.
- Keep tokens out of code and out of git. Rotate any token that appears in a chat.
