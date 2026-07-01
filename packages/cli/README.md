# @qashifthq/verity

CLI runner for [Verity](https://verity-kappa-ebon.vercel.app) — AI-augmented Playwright testing by QAShift.

Runs your Playwright suite, reruns failures to separate flaky from broken, and reports results to Verity.

```bash
# Quick check (diff-aware subset) — a fast sanity check
npx @qashifthq/verity run --tier fast --token $VERITY_INGEST_TOKEN

# Full regression (entire suite) — the safety net
npx @qashifthq/verity run --tier full --token $VERITY_INGEST_TOKEN
```

Env: `VERITY_API_URL` (default Verity cloud), `VERITY_RERUNS` (default 3). MIT licensed.
