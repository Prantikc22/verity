# Verity — setup on a new machine

This project is **not in git** — it lives only in this folder. Keep a backup. The
critical, non-recreatable file is **`apps/web/.env.local`** (all your secrets).
Everything else can be rebuilt.

## 1. Prerequisites

- **Node.js ≥ 20** — install from https://nodejs.org or `brew install node`.
- (Optional) The Vercel CLI is used via `npx`, no global install needed.

Verify:

```bash
node -v      # must be v20 or newer
```

## 2. Install dependencies

From the project root (`Verity/`):

```bash
npm install                     # rebuilds node_modules for all workspaces (~1–2 min)
```

If you'll run browser tests locally:

```bash
npx playwright install chromium
```

## 3. Confirm your secrets are present

The transferred zip includes `apps/web/.env.local`. Confirm it exists and is non-empty:

```bash
test -s apps/web/.env.local && echo "env OK" || echo "MISSING — restore it before deploying"
```

Without it, generation, ingestion, GitHub, and the runner will not work. `.env.example`
lists every variable name if you ever need to rebuild it.

## 4. Run it locally

```bash
npm run dev                     # http://localhost:3000
```

## 5. Deploy (publishes to https://verity-kappa-ebon.vercel.app)

The Vercel CLI login is **not** in this folder (it's stored on the machine), so log in once:

```bash
npx vercel login                # use the account that owns the "verity" project
npx vercel deploy --prod --yes  # from the project root
```

`.vercel/project.json` already links this folder to the correct Vercel project, so the
deploy targets the right place automatically.

## 6. Sanity checks

```bash
cd apps/web && npx tsc --noEmit   # typecheck (should be clean)
cd ../packages/core && npm test   # core unit tests (should pass)
cd ../.. && npm run build         # full production build
```

## Notes

- **Back it up.** One folder on one laptop is fragile. Consider a private GitHub repo
  (secrets stay out via `.gitignore` — copy `apps/web/.env.local` over manually).
- **`CLAUDE.md`** in this folder tells Claude Code everything about the architecture,
  commands, live infra, and deploy boundaries — open Claude Code here and it'll understand
  the project.
- The `.env.local` contains **live secrets** — don't share this folder or its zip with anyone.
