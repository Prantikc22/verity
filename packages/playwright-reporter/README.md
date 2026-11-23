# @qashifthq/playwright-reporter

QAShift Reports for Playwright: every run, every retry, flaky and slow tests, in one place.

```bash
npm i -D @qashifthq/playwright-reporter
```

```ts
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['@qashifthq/playwright-reporter']],
})
```

Set `QASHIFT_TOKEN` in your CI secrets (find it under Project → Settings). That's it.

- A test that fails and then passes on retry is recorded as **flaky**, not green.
- The reporter never fails your build. If the upload fails, it prints a warning.
- Options: `token`, `apiUrl`, `tier` (`full` | `fast`), `silent`.

Not using Playwright? Upload JUnit XML from any framework:

```bash
npx @qashifthq/verity upload results.xml --token $QASHIFT_TOKEN
```
