"use client";

import { useState } from "react";

const PKG = "@qashifthq/verity-mcp";
const SERVER = { command: "npx", args: ["-y", PKG], env: { VERITY_TOKEN: "YOUR_VERITY_TOKEN" } };
const JSON_BLOCK = JSON.stringify({ mcpServers: { verity: SERVER } }, null, 2);
const CLAUDE_CMD = `claude mcp add verity --env VERITY_TOKEN=YOUR_VERITY_TOKEN -- npx -y ${PKG}`;
const VSCODE_CLI = `code --add-mcp '${JSON.stringify({ name: "verity", ...SERVER })}'`;

// One-click deep links.
const VSCODE_LINK = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "verity", ...SERVER }))}`;
const CURSOR_LINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=verity&config=${
  typeof window === "undefined" ? "" : btoa(JSON.stringify(SERVER))
}`;

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="shrink-0 border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function CodeRow({ code }: { code: string }) {
  return (
    <div className="mt-2 flex items-start gap-2">
      <pre className="flex-1 overflow-x-auto border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed dark:border-neutral-800 dark:bg-neutral-900/60"><code>{code}</code></pre>
      <Copy text={code} />
    </div>
  );
}

const TABS = ["VS Code", "Cursor", "Claude Code", "Windsurf", "Other"] as const;
type Tab = (typeof TABS)[number];

export function McpInstall() {
  const [tab, setTab] = useState<Tab>("VS Code");

  return (
    <div>
      {/* Prerequisites */}
      <div className="grid gap-4 border border-neutral-200 p-6 sm:grid-cols-3 dark:border-neutral-800">
        {[
          { n: "01", t: "Node.js 18+ (required)", d: "The server runs via npx. Install from nodejs.org — a system install, then fully restart your IDE." },
          { n: "02", t: "A compatible IDE", d: "Cursor, VS Code, Claude Code, Windsurf, or any MCP-capable client." },
          { n: "03", t: "Your project token", d: "Free account → Dashboard → project → Local / MCP. It authenticates the server." },
        ].map((p) => (
          <div key={p.n}>
            <div className="font-mono text-xs text-neutral-400">{p.n}</div>
            <div className="mt-1 font-semibold">{p.t}</div>
            <div className="mt-1 text-sm text-neutral-500">{p.d}</div>
          </div>
        ))}
      </div>

      {/* IDE tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium transition ${tab === t ? "bg-indigo-600 text-white" : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 border border-neutral-200 p-6 dark:border-neutral-800">
        {tab === "VS Code" && (
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">One click — VS Code will open and add the Verity MCP server. Then paste your project token when prompted.</p>
            <a href={VSCODE_LINK} className="mt-3 inline-flex items-center gap-2 bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Install in VS Code →
            </a>
            <p className="mt-5 text-sm font-medium">Or from the terminal:</p>
            <CodeRow code={VSCODE_CLI} />
          </div>
        )}
        {tab === "Cursor" && (
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">One click to add it to Cursor, or drop the JSON into <code>.cursor/mcp.json</code>.</p>
            <a href={CURSOR_LINK} className="mt-3 inline-flex items-center gap-2 bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Add to Cursor →
            </a>
            <p className="mt-5 text-sm font-medium"><code>.cursor/mcp.json</code></p>
            <CodeRow code={JSON_BLOCK} />
          </div>
        )}
        {tab === "Claude Code" && (
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Run this once in your project — it registers the server for Claude Code.</p>
            <CodeRow code={CLAUDE_CMD} />
          </div>
        )}
        {tab === "Windsurf" && (
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Add to your Windsurf MCP config (<code>~/.codeium/windsurf/mcp_config.json</code>):</p>
            <CodeRow code={JSON_BLOCK} />
          </div>
        )}
        {tab === "Other" && (
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Any MCP-capable client — add this server definition and set <code>VERITY_TOKEN</code>:</p>
            <CodeRow code={JSON_BLOCK} />
          </div>
        )}
        <p className="mt-5 text-xs text-neutral-500">Replace <code>YOUR_VERITY_TOKEN</code> with your project token from the dashboard (Local / MCP). Keep it secret — it&apos;s the same token your CI uses.</p>
      </div>

      {/* Troubleshooting */}
      <details className="mt-4 border border-neutral-200 p-5 dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-semibold">Getting <code>spawn npx ENOENT</code>?</summary>
        <div className="mt-3 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
          <p>That means your IDE can&apos;t find <code>npx</code> — GUI apps don&apos;t inherit your terminal&apos;s PATH (common if Node was installed via nvm). Fixes, in order:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Install Node.js from <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-indigo-600 underline">nodejs.org</a> (a system install, not only nvm), then <strong>fully quit and reopen</strong> your IDE.</li>
            <li>Still failing? Use the absolute path to npx. Find it with <code>which npx</code> in your terminal, then set that as the <code>command</code>:</li>
          </ol>
          <CodeRow code={`{
  "mcpServers": {
    "verity": {
      "command": "/absolute/path/to/npx",
      "args": ["-y", "${PKG}"],
      "env": { "VERITY_TOKEN": "YOUR_VERITY_TOKEN" }
    }
  }
}`} />
          <p className="text-xs text-neutral-500">On macOS the path is usually <code>/opt/homebrew/bin/npx</code> (Apple silicon), <code>/usr/local/bin/npx</code> (Intel), or <code>~/.nvm/versions/node/vXX/bin/npx</code> (nvm).</p>
        </div>
      </details>
    </div>
  );
}
