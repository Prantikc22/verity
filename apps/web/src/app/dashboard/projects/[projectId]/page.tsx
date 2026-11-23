import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/catalog";
import { KpiStrip, Panel, Chip, fmtDuration, timeAgo } from "@/components/shell/ui";
import { RunsTable, RUN_COLUMNS, type RunRow } from "@/components/shell/RunsTable";

export const metadata: Metadata = { title: "Project", robots: { index: false } };

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const base = `/dashboard/projects/${projectId}`;

  const [{ data: tests }, { data: runs }, { data: a11y }, { count: healingOpen }] = await Promise.all([
    supabase.from("tests").select("kind").eq("project_id", projectId).neq("status", "archived").limit(5000),
    supabase.from("test_runs").select(RUN_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
    supabase.from("a11y_scans").select("score, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
    supabase.from("healing_events").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "suggested"),
  ]);

  const list = (runs ?? []) as RunRow[];
  const done = list.filter((r) => r.status === "completed");
  const last = done[0];
  const totals = done.slice(0, 10);
  const results = totals.reduce((n, r) => n + r.total, 0);
  const passed = totals.reduce((n, r) => n + r.passed, 0);
  const flaky = totals.reduce((n, r) => n + r.flaky, 0);
  const byKind = new Map<string, number>();
  for (const t of tests ?? []) byKind.set(t.kind, (byKind.get(t.kind) ?? 0) + 1);
  const testCount = tests?.length ?? 0;
  const lastA11y = a11y?.[0];

  const steps = [
    { done: testCount > 0, title: "Create tests", body: "Pick an agent and a target. Keep the tests you want.", href: `${base}/create` },
    { done: list.length > 0, title: "Connect CI", body: "Copy one step into GitHub Actions, GitLab or Jenkins.", href: `${base}/ci` },
    { done: !!lastA11y, title: "Add accessibility", body: "Lumen scans each deploy and flags regressions.", href: `${base}/accessibility` },
  ];
  const setupLeft = steps.filter((s) => !s.done).length;

  return (
    <>
      {setupLeft > 0 && (
        <Panel title="Set up this project" action={`${steps.length - setupLeft} of ${steps.length} done`} flush className="mb-5">
          <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-950">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${s.done ? "bg-emerald-500 text-white" : "border border-neutral-300 text-neutral-500 dark:border-neutral-700"}`}>{s.done ? "✓" : i + 1}</span>
                  <span className="min-w-0 flex-1"><span className={`block text-[13px] font-medium ${s.done ? "text-neutral-400 line-through" : ""}`}>{s.title}</span><span className="block text-[12.5px] text-neutral-500">{s.body}</span></span>
                  {!s.done && <span className="text-[12.5px] font-medium text-violet-700 dark:text-violet-400">Start →</span>}
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <KpiStrip items={[
        { label: "Tests", value: String(testCount), sub: `${byKind.size} agent${byKind.size === 1 ? "" : "s"} in use` },
        { label: "Pass rate · last 10 runs", value: results ? `${((passed / results) * 100).toFixed(1)}%` : "—", tone: results ? (passed / results >= 0.95 ? "ok" : "warn") : undefined },
        { label: "Flaky · last 10 runs", value: results ? String(flaky) : "—", tone: flaky ? "warn" : undefined },
        { label: "Last run", value: last ? timeAgo(last.created_at) : "—", sub: last ? fmtDuration(last.duration_ms) : "no runs yet" },
      ]} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title="Recent runs" action={<Link href={`${base}/runs`} className="hover:text-neutral-900 dark:hover:text-white">All runs →</Link>} flush>
          {list.length ? <RunsTable runs={list.slice(0, 8)} showProject={false} /> : <p className="p-4 text-[13px] text-neutral-500">No runs yet. <Link href={`${base}/ci`} className="font-medium text-violet-700 hover:underline">Connect CI</Link> to start recording.</p>}
        </Panel>

        <div className="space-y-5">
          <Panel title="Agents" flush>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {AGENTS.map((a) => {
                const n = a.key === "accessibility" ? (lastA11y ? 1 : 0) : a.disciplines.reduce((s, d) => s + (byKind.get(d) ?? 0), 0);
                return (
                  <li key={a.key}>
                    <Link href={a.projectPath ? `${base}/${a.projectPath}` : base} className="flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-neutral-50 dark:hover:bg-neutral-950">
                      <span><span className="font-medium">{a.codename}</span> <span className="text-neutral-500">{a.name.replace(" Agent", "")}</span></span>
                      <span className="tnum text-[12px] text-neutral-500">{a.key === "accessibility" ? (lastA11y?.score != null ? `score ${Math.round(Number(lastA11y.score))}` : "not set up") : n ? `${n} test${n === 1 ? "" : "s"}` : "—"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
          {(healingOpen ?? 0) > 0 && (
            <Panel title="Suggested fixes" action={<Chip tone="warn">{healingOpen}</Chip>}>
              <p className="text-[13px] text-neutral-500">Tracer proposed locator fixes during recent runs. Review them as diffs; nothing merges on its own.</p>
              <Link href={`${base}/runs`} className="mt-2 inline-block text-[13px] font-medium text-violet-700 hover:underline">Review →</Link>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
