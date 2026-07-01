import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IngestToken } from "../IngestToken";

export const metadata: Metadata = { title: "Local / MCP", robots: { index: false } };

export default async function McpPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: tests }, { data: localRuns }] = await Promise.all([
    supabase.from("projects").select("ingest_token").eq("id", projectId).maybeSingle(),
    supabase.from("tests").select("id, name, spec_path, status, created_at").eq("project_id", projectId).eq("origin", "mcp").order("created_at", { ascending: false }),
    supabase.from("test_runs").select("id, passed, failed, flaky, branch, created_at").eq("project_id", projectId).eq("trigger", "manual").order("created_at", { ascending: false }).limit(10),
  ]);
  if (!project) notFound();

  const config = `{
  "mcpServers": {
    "verity": {
      "command": "npx",
      "args": ["-y", "@qashifthq/verity-mcp"],
      "env": { "VERITY_TOKEN": "<paste your project token>" }
    }
  }
}`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Local testing with the Verity MCP</h2>
        <p className="text-xs text-neutral-500">
          Test on <strong>localhost</strong> straight from Cursor, Claude Code, or VS Code. The MCP runs Playwright in
          <strong> your own repo</strong> (no cloud browser), generates tests, and reports results back here.
        </p>
      </div>

      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <h3 className="text-sm font-medium">1 · Your project token</h3>
        <p className="mt-1 text-xs text-neutral-500">The MCP authenticates with this (same token your CI uses). Keep it secret.</p>
        <div className="mt-3"><IngestToken token={project.ingest_token} /></div>
      </section>

      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <h3 className="text-sm font-medium">2 · Add the MCP server</h3>
        <p className="mt-1 text-xs text-neutral-500">Add to <code>.cursor/mcp.json</code>, Claude Code, or your VS Code MCP config, then paste your token:</p>
        <pre className="mt-3 overflow-x-auto border border-neutral-200 bg-neutral-950 p-4 text-xs text-neutral-300 dark:border-neutral-800"><code>{config}</code></pre>
      </section>

      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <h3 className="text-sm font-medium">3 · Ask your assistant</h3>
        <p className="mt-2 text-xs text-neutral-500">Once connected, just ask. The MCP exposes these tools:</p>
        <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
          <li><code>verity_propose_tests</code> — “what should I test?” for the <strong>full app</strong> or just your <strong>diff</strong> (uses <code>git diff</code>). Optional PRD + localhost URL.</li>
          <li><code>verity_generate_test</code> — generate a spec, save it here, and write the <code>.spec.ts</code> into your repo.</li>
          <li><code>verity_run</code> — run Playwright on your machine (one spec, all, or diff), detect flakes, report back.</li>
          <li><code>verity_list_tests</code> · <code>verity_status</code></li>
        </ul>
        <p className="mt-3 border-l-2 border-indigo-500 pl-3 text-xs italic text-neutral-500">
          “Connect to Verity, propose tests for my diff, generate the top two, then run them against http://localhost:3000.”
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-500">Tests created via MCP ({tests?.length ?? 0})</h3>
          {tests && tests.length > 0 && (
            <a href={`/dashboard/projects/${projectId}/tests`} className="text-xs font-medium text-indigo-600 hover:underline">Manage &amp; organize in Tests →</a>
          )}
        </div>
        {!tests || tests.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">None yet. Generate one from your IDE with <code>verity_generate_test</code>.</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-neutral-100 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {tests.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{t.name} <span className="font-mono text-xs text-neutral-400">{t.spec_path}</span></span>
                  <span className="text-xs text-neutral-400">{t.status}</span>
                </li>
              ))}
            </ul>
            {tests.length > 6 && (
              <p className="mt-2 text-xs text-neutral-500">+ {tests.length - 6} more. Group them into suites, move them to a test plan, or run them on the <a href={`/dashboard/projects/${projectId}/tests`} className="text-indigo-600 underline">Tests</a> page.</p>
            )}
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-neutral-500">Local runs ({localRuns?.length ?? 0})</h3>
        {!localRuns || localRuns.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No local runs yet. Use <code>verity_run</code> from your IDE.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {localRuns.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-xs text-neutral-500">{r.branch ?? "local"} · {new Date(r.created_at).toLocaleString()}</span>
                <span className="text-xs"><span className="text-emerald-600">{r.passed}✓</span> <span className="text-red-600">{r.failed}✕</span> <span className="text-amber-600">{r.flaky}~</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
