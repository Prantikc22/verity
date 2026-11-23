# @qashifthq/verity

The QAShift command line. Run your Playwright suite, separate flaky tests from broken ones, and send results to [QAShift](https://qashifthq.com) Reports.

Using Playwright? The simplest path is the reporter: [`@qashifthq/playwright-reporter`](https://www.npmjs.com/package/@qashifthq/playwright-reporter).

## Upload JUnit XML (any framework)

```bash
npx @qashifthq/verity upload results.xml --token $QASHIFT_TOKEN
```

Jest (`jest-junit`), pytest (`--junitxml`), Cypress, Vitest, Go, JUnit and .NET all write JUnit XML. Retries that appear as repeated test cases count as flaky.

## Run Playwright with reruns

```bash
npx @qashifthq/verity run --tier fast --token $QASHIFT_TOKEN   # smoke tier, on every PR
npx @qashifthq/verity run --tier full --token $QASHIFT_TOKEN   # whole suite, on merge
```

Failures are rerun (default 3 times). A test that fails then passes is reported as flaky, not broken.

## Performance and security checks

```bash
# needs k6 installed and a generated tests/verity/perf/verity.k6.js
npx @qashifthq/verity perf --profile load --target https://api.example.com --token $QASHIFT_TOKEN
npx @qashifthq/verity security --target https://staging.example.com --dast --token $QASHIFT_TOKEN
```

## Environment

| Variable | Default |
| --- | --- |
| `QASHIFT_TOKEN` | your project token (from the QAShift app → CI setup) |
| `QASHIFT_API_URL` | `https://verity.qashifthq.com` |
| `VERITY_RERUNS` | `3` |

`VERITY_INGEST_TOKEN` and `VERITY_API_URL` still work. MIT licensed.
