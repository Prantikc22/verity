#!/usr/bin/env node
/**
 * Verity MCP server. Add it to Cursor / Claude Code / VS Code to generate,
 * propose, and RUN Playwright tests against your localhost — the tests execute
 * in your own repo (npx playwright test), so no cloud browser is needed.
 *
 * Config (e.g. .cursor/mcp.json or claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "verity": {
 *         "command": "npx",
 *         "args": ["-y", "@qashifthq/verity-mcp"],
 *         "env": { "VERITY_TOKEN": "<project ingest token>" }
 *       }
 *     }
 *   }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";

const API = (process.env.VERITY_API_URL ?? "https://verity-kappa-ebon.vercel.app").replace(/\/$/, "");
const TOKEN = process.env.VERITY_TOKEN ?? process.env.VERITY_INGEST_TOKEN;
const RERUNS = Number(process.env.VERITY_RERUNS ?? 3);

function text(t) {
  return { content: [{ type: "text", text: t }] };
}
async function api(path, method = "GET", body) {
  if (!TOKEN) throw new Error("VERITY_TOKEN is not set. Add your project token to the MCP server env.");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${path} failed (${res.status})`);
  return data;
}
function git(args) {
  try { return execSync(`git ${args}`, { encoding: "utf8" }).trim(); } catch { return ""; }
}
/**
 * Fetch a page's HTML FROM THIS MACHINE. Crucial for localhost/dev URLs — Verity's
 * cloud server can't reach your machine, so the MCP grabs the HTML here and sends
 * it along, giving generation real locators from the actual page you're running.
 */
async function fetchHtml(url) {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return undefined;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return undefined;
    return (await res.text()).slice(0, 800_000);
  } catch { return undefined; }
}
/**
 * Parse a JSON object out of noisy text. Playwright's JSON reporter prints to
 * stdout, but dotenv banners, framework logs, or stray console.log in a test can
 * pollute it — so we isolate the outermost { … } before parsing.
 */
function parseJsonLoose(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { /* fall through */ }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch { /* give up */ }
  }
  return null;
}

const server = new McpServer({ name: "verity", version: "0.1.0" });

server.tool(
  "verity_status",
  "Show the connected Verity project and how many tests it has.",
  {},
  async () => {
    const d = await api("/api/mcp/tests");
    return text(`Connected to Verity project "${d.project.name}" (branch ${d.project.default_branch}). ${d.tests.length} test(s).`);
  },
);

server.tool(
  "verity_propose_tests",
  "Propose a set of Playwright tests to write. scope 'full' covers the whole app/page; scope 'diff' focuses on your uncommitted/branch changes (uses git diff). Optionally pass a localhost url and/or a PRD for accuracy.",
  {
    scope: z.enum(["full", "diff"]).default("full"),
    url: z.string().url().optional(),
    prd: z.string().optional(),
  },
  async ({ scope, url, prd }) => {
    const changedFiles = scope === "diff"
      ? git("diff --name-only HEAD").split("\n").filter(Boolean).concat(git("diff --name-only --cached").split("\n").filter(Boolean))
      : [];
    const pageHtml = await fetchHtml(url); // fetched locally so localhost works
    const d = await api("/api/mcp/propose", "POST", { scope, url, prd, changedFiles: [...new Set(changedFiles)], pageHtml });
    if (!d.candidates?.length) return text("No tests proposed. Try passing a url and/or a PRD.");
    const lines = d.candidates.map((c, i) =>
      `${i + 1}. [${c.priority}] ${c.title}\n   ${c.intent}\n   - ${c.plan.join("\n   - ")}`,
    );
    return text(
      `Proposed ${d.candidates.length} test(s)${scope === "diff" ? ` for ${changedFiles.length} changed file(s)` : ""}` +
      `${d.used_live_context ? " (from your live page)" : ""}:\n\n${lines.join("\n\n")}\n\n` +
      `Use verity_generate_test to create any of these (pass its title as the name and a short description).`,
    );
  },
);

server.tool(
  "verity_generate_test",
  "Generate a Playwright test and save it to the Verity project AND write the .spec.ts into this repo. Provide a localhost url and/or a description (and optional PRD).",
  {
    name: z.string().optional(),
    url: z.string().url().optional(),
    description: z.string().optional(),
    prd: z.string().optional(),
    criticalPath: z.boolean().optional(),
    writeFile: z.boolean().default(true),
  },
  async ({ name, url, description, prd, criticalPath, writeFile }) => {
    const pageHtml = await fetchHtml(url); // fetched locally so localhost works
    const d = await api("/api/mcp/generate", "POST", { name, url, description, prd, criticalPath, pageHtml });
    let wrote = "";
    if (writeFile) {
      const path = resolve(process.cwd(), d.spec_path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, d.spec_content, "utf8");
      wrote = `\nWrote ${d.spec_path} into your repo.`;
    }
    return text(`Generated "${name ?? d.spec_path}".${wrote}\n\nPlan:\n- ${(d.plan ?? []).join("\n- ")}\n\n${d.spec_content}`);
  },
);

server.tool(
  "verity_list_tests",
  "List the tests in the connected Verity project.",
  {},
  async () => {
    const d = await api("/api/mcp/tests");
    if (!d.tests.length) return text("No tests yet. Use verity_generate_test.");
    return text(d.tests.map((t) => `- ${t.name} (${t.spec_path}) [${t.status}, ${t.origin}]`).join("\n"));
  },
);

server.tool(
  "verity_run",
  "Run Playwright tests on THIS machine (npx playwright test in the current repo), rerun failures to detect flakes, and report results to Verity. Pass a specPath to run one, or all=true / diff=true.",
  {
    specPath: z.string().optional(),
    all: z.boolean().default(false),
    diff: z.boolean().default(false),
  },
  async ({ specPath, all, diff }) => {
    const commit = git("rev-parse HEAD") || "local";
    const branch = git("rev-parse --abbrev-ref HEAD") || "local";
    const changed = diff ? git("diff --name-only HEAD").split("\n").filter(Boolean) : [];

    const runPw = (grep) => {
      // Have the JSON reporter write to a file — that's immune to stray stdout.
      // Fall back to isolating the JSON object from stdout/stderr if the file
      // isn't there (older Playwright that ignores the env var).
      const outFile = join(tmpdir(), `verity-pw-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
      const args = ["playwright", "test", "--reporter=json", ...(specPath ? [specPath] : []), ...(grep ? ["--grep", grep] : [])];
      const res = spawnSync("npx", args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        cwd: process.cwd(),
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: outFile },
      });
      let report = null;
      try { report = JSON.parse(readFileSync(outFile, "utf8")); } catch { /* try stdout */ }
      try { unlinkSync(outFile); } catch { /* best effort */ }
      return report ?? parseJsonLoose(res.stdout) ?? parseJsonLoose(res.stderr);
    };
    const collect = (report) => {
      const out = [];
      const walk = (s, f) => {
        const file = s.file ?? f;
        for (const spec of s.specs ?? []) {
          const ok = spec.tests?.every((t) => t.results?.every((r) => r.status === "passed" || r.status === "expected"));
          out.push({ file, title: spec.title, ok: !!ok });
        }
        for (const c of s.suites ?? []) walk(c, file);
      };
      for (const s of report?.suites ?? []) walk(s, s.file);
      return out;
    };

    const first = runPw();
    if (!first) return text(
      "Could not run Playwright in this repo. Checklist:\n" +
      "1. You're in the project root (where playwright.config.* lives).\n" +
      "2. @playwright/test is installed (`npm i -D @playwright/test`).\n" +
      "3. Browsers are installed (`npx playwright install`).\n" +
      (specPath ? `4. The spec exists: ${specPath}.` : "4. There's at least one *.spec.ts under your testDir."),
    );

    const specs = collect(first);
    if (!specs.length) return text(
      `Playwright ran but matched no tests${specPath ? ` for ${specPath}` : ""}. ` +
      "Generate one first with verity_generate_test, or check your testDir / file path.",
    );
    const results = [];
    for (const s of specs) {
      const attempts = [s.ok];
      if (!s.ok) for (let i = 1; i < RERUNS; i++) {
        const r = collect(runPw(s.title)).find((x) => x.title === s.title);
        attempts.push(r ? r.ok : false);
      }
      results.push({ spec_path: s.file, name: s.title, attempts });
    }

    const d = await api("/api/ingest", "POST", {
      tier: all || !diff ? "full" : "fast",
      trigger: "manual",
      commit_sha: commit,
      branch,
      changed_files: changed,
      suite_total: specs.length,
      results,
    });
    return text(`Ran ${specs.length} test(s) locally → ${d.summary.passed} passed, ${d.summary.failed} failed, ${d.summary.flaky} flaky. Reported to Verity (${d.tier_label}).`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("verity-mcp ready");
