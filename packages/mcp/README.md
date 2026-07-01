# @qashifthq/verity-mcp

MCP server for [Verity](https://verity-kappa-ebon.vercel.app) — propose, generate, and **run Playwright tests on your localhost** straight from Cursor, Claude Code, VS Code, or any MCP client. Tests execute in **your own repo** (`npx playwright test`), so there's no cloud browser to wait on, and results are reported back to your Verity project.

---

## 1. Get your project token

Verity → your project → **Local / MCP** → copy the **project token** (it's the same token your CI uses — keep it secret).

## 2. Add the server to your IDE

The server speaks MCP over **stdio**. Add it to your client's MCP config and paste your token.

**Claude Code** (`.mcp.json` in your repo, or `claude mcp add`):

```json
{
  "mcpServers": {
    "verity": {
      "command": "npx",
      "args": ["-y", "@qashifthq/verity-mcp"],
      "env": { "VERITY_TOKEN": "<your project token>" }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`) and **VS Code** (`.vscode/mcp.json` / MCP settings) use the **same shape**.

Reload the window. Your client should report **5 tools discovered** (`verity_status`, `verity_propose_tests`, `verity_generate_test`, `verity_list_tests`, `verity_run`). That's the server connected and working.

## 3. Use it — from chat, not the shell

> ⚠️ **The server is not a CLI.** Running `npx @qashifthq/verity-mcp verity_generate_test --url …` does nothing useful — it's a stdio server that prints `verity-mcp ready` and waits for an MCP client. **Invoke the tools from your IDE's chat**, e.g.:

> "Use Verity to propose tests for http://localhost:3000, generate the top 3, then run them."

> "Verity: propose tests for my current diff, generate the high-priority ones, and run them locally."

> "Run all my Verity tests locally and report flakes."

---

## Tools

| Tool | What it does |
|---|---|
| `verity_status` | Show the connected project + how many tests it has. Good first call to confirm the token works. |
| `verity_propose_tests` | Ask AI what to test. `scope: "full"` covers the whole app/page; `scope: "diff"` focuses on your uncommitted/branch changes (via `git diff`). Optional localhost `url` + `prd`. |
| `verity_generate_test` | Generate a Playwright spec, save it to Verity, **and** write the `.spec.ts` into your repo. |
| `verity_list_tests` | List the project's tests. |
| `verity_run` | Run Playwright **on this machine** (one `specPath`, `all`, or `diff`), rerun failures to detect flakes, and report results to Verity. |

## How `verity_run` works (and what it needs)

It shells out to `npx playwright test` in your **current working directory**, so the same prerequisites as running Playwright by hand apply:

1. Run your IDE from the **project root** (where `playwright.config.*` lives).
2. `@playwright/test` is installed — `npm i -D @playwright/test`.
3. Browsers are installed — `npx playwright install`.
4. Your app is running if the tests hit `localhost` (e.g. `npm run dev`), unless your Playwright config starts it via `webServer`.

It reads results from the JSON reporter via a temp file (`PLAYWRIGHT_JSON_OUTPUT_NAME`) so stray `stdout` from dotenv banners or `console.log` in tests can't corrupt parsing. Failures are re-run `VERITY_RERUNS` times (default 3) to separate **flaky** from **failing**.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `VERITY_TOKEN` | — | **Required.** Your project token. (`VERITY_INGEST_TOKEN` also accepted.) |
| `VERITY_API_URL` | `https://verity-kappa-ebon.vercel.app` | Point at a self-hosted Verity. |
| `VERITY_RERUNS` | `3` | How many times to re-run a failing test to detect flakes. |

## Troubleshooting

- **"Process exited with code null" in the IDE log** — that's an idle shutdown; the client reconnects on the next tool call. Not an error.
- **5 tools discovered but a call fails with "Invalid project token"** — the `VERITY_TOKEN` is wrong or for a different project. Re-copy it from Local / MCP.
- **`verity_run` says it matched no tests** — you're likely not in the project root, or the spec path is wrong. `cd` to where `playwright.config.*` is and retry.
- **`verity_run` says it couldn't run Playwright** — install it: `npm i -D @playwright/test && npx playwright install`.

MIT licensed.
