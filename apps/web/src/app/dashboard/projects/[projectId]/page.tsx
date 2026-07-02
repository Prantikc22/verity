import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProjectTrend } from "./ProjectTrend";
import { GettingStarted } from "./GettingStarted";

export const metadata: Metadata = { title: "Project", robots: { index: false } };

function Stat({ v, k, href }: { v: string; k: string; href?: string }) {
  const inner = (
    <div className="v-card border border-neutral-200 p-4 hover:border-indigo-400 dark:border-neutral-800 dark:hover:border-indigo-600">
      <div className="tnum text-2xl font-semibold">{v}</div>
      <div className="mt-1 text-xs text-neutral-500">{k}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ count: testCount }, { count: runCount }, { data: runs }, { count: healingOpen }] = await Promise.all([
    supabase.from("tests").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("test_runs").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("test_runs").select("created_at, total, passed, failed, flaky, tier").eq("project_id", projectId).eq("status", "completed").order("created_at", { ascending: true }).limit(30),
    supabase.from("healing_events").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "suggested"),
  ]);

  const r = runs ?? [];
  const latest = r[r.length - 1];
  const passRate = latest && latest.total ? Math.round((latest.passed / latest.total) * 100) : null;
  const flakeRate = latest && latest.total ? Math.round((latest.flaky / latest.total) * 100) : null;

  return (
    <div>
      <GettingStarted projectId={projectId} hasTests={(testCount ?? 0) > 0} hasRuns={(runCount ?? 0) > 0} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat v={`${testCount ?? 0}`} k="tests" href={`/dashboard/projects/${projectId}/tests`} />
        <Stat v={`${runCount ?? 0}`} k="CI runs" href={`/dashboard/projects/${projectId}/runs`} />
        <Stat v={passRate === null ? "—" : `${passRate}%`} k="latest pass rate" />
        <Stat v={flakeRate === null ? "—" : `${flakeRate}%`} k="latest flake rate" />
      </div>

      {/* Trend */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Trend (last {r.length} run{r.length === 1 ? "" : "s"})</h2>
          <Link href="/dashboard/trends" className="text-xs text-indigo-600 hover:underline">All trends →</Link>
        </div>
        {r.length < 2 ? (
          <p className="mt-3 text-sm text-neutral-500">Not enough completed runs yet to chart. Wire your CI (Settings) to start recording.</p>
        ) : (
          <ProjectTrend
            pass={r.map((x) => (x.total ? x.passed / x.total : 0))}
            flake={r.map((x) => (x.total ? x.flaky / x.total : 0))}
            volume={r.map((x) => x.total)}
          />
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/dashboard/projects/${projectId}/ci`} className="group v-card border border-indigo-300 bg-indigo-50/40 p-5 hover:border-indigo-500 dark:border-indigo-800 dark:bg-indigo-950/20">
          <div className="text-sm font-semibold">⚙️ CI Setup</div>
          <p className="mt-1 text-xs text-neutral-500">Turn UI, API, visual, agent, performance &amp; security on/off and get your pipeline config.</p>
        </Link>
        <Link href={`/dashboard/projects/${projectId}/generate`} className="group v-card border border-neutral-200 p-5 hover:border-indigo-400 dark:border-neutral-800">
          <div className="text-sm font-semibold">＋ Generate tests</div>
          <p className="mt-1 text-xs text-neutral-500">Give a URL + PRD; Verity proposes tests and you pick which to add.</p>
        </Link>
        <Link href={`/dashboard/projects/${projectId}/cloud`} className="group v-card border border-neutral-200 p-5 hover:border-indigo-400 dark:border-neutral-800">
          <div className="text-sm font-semibold">▶ Run in cloud</div>
          <p className="mt-1 text-xs text-neutral-500">Watch a saved test execute live in a real browser. Capped — CI is unlimited.</p>
        </Link>
        <Link href={`/dashboard/projects/${projectId}/runs`} className="group v-card border border-neutral-200 p-5 hover:border-indigo-400 dark:border-neutral-800">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>🩹 Self-healing</span>
            {(healingOpen ?? 0) > 0 && <span className="bg-amber-500 px-1.5 text-[10px] text-white">{healingOpen}</span>}
          </div>
          <p className="mt-1 text-xs text-neutral-500">Review locator fixes Verity proposed during runs.</p>
        </Link>
      </section>
    </div>
  );
}
