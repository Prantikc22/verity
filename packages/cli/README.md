# @qashifthq/verity

CLI runner for [Verity](https://verity-kappa-ebon.vercel.app) — AI-augmented Playwright testing by QAShift.

Runs your Playwright suite, reruns failures to separate flaky from broken, and reports results to Verity.

```bash
# Quick check (diff-aware subset) — a fast sanity check
npx @qashifthq/verity run --tier fast --token $VERITY_INGEST_TOKEN

# Full regression (entire suite) — the safety net
npx @qashifthq/verity run --tier full --token $VERITY_INGEST_TOKEN
```

## Performance & security — run on your own machine

Run the real engines locally (nothing runs on our infra) and post results to your dashboard:

```bash
# Load test with k6 — pick any profile: smoke|load|stress|spike|soak|breakpoint
# (needs k6 installed + a generated tests/verity/perf/verity.k6.js)
npx @qashifthq/verity perf --profile load --target https://api.example.com --token $VERITY_INGEST_TOKEN

# Security scan — static (semgrep, code) + dynamic (headers/exposure) baseline
npx @qashifthq/verity security --target https://staging.example.com --dast --token $VERITY_INGEST_TOKEN
```

Env: `VERITY_API_URL` (default Verity cloud), `VERITY_RERUNS` (default 3). MIT licensed.
