# Verity MCP — localhost test target

A tiny app (**MyGreenhouse**) + a ready Playwright project so you can try the Verity MCP on **localhost** in Cursor / Claude Code / VS Code.

The app has a login (visible demo creds), an error state, and an add-to-list flow — enough to generate several real tests.

## 1. Run the app + install Playwright

```bash
cd examples/localhost-app
npm install
npx playwright install chromium
npm start          # serves http://localhost:3000
```

Demo login: **username** `gardener` · **password** `Greenhouse123`.

## 2. Connect the Verity MCP

Grab your **project token** from Verity → your project → **Local / MCP**, then add to `.cursor/mcp.json` (or your Claude Code / VS Code MCP config):

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

## 3. Ask your assistant

> "Connect to Verity. Propose tests for http://localhost:3000 (it's a login + add-plant app, creds gardener / Greenhouse123). Generate the top 3, write them into this repo, then run them."

The MCP will:
1. `verity_propose_tests` — decide what's worth testing (full app or your `git diff`).
2. `verity_generate_test` — generate specs, save them to Verity, and write `.spec.ts` files into `./tests`.
3. `verity_run` — run `npx playwright test` **on your machine** against `localhost:3000`, rerun failures to detect flakes, and report results back to Verity.

No cloud browser needed — everything runs locally.
