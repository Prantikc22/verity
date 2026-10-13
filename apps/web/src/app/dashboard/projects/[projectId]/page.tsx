import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProjectTrend } from "./ProjectTrend";
import { GettingStarted } from "./GettingStarted";

export const metadata: Metadata = { title: "Project", robots: { index: false } };

type Tone = "neutral" | "good" | "warn" | "bad";
const TONE: Record<Tone, { text: string; dot: string }> = {
  neutral: { text: "", dot: "bg-neutral-300 dark:bg-neutral-700" },
  good: { text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  warn: { text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  bad: { text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

function Stat({ v, k, href, tone = "neutral" }: { v: string; k: string; href?: string; tone?: Tone }) {
  const t = TONE[tone];
  const inner = (
    <div className="v-card border border-neutral-200 p-4 hover:border-indigo-400 dark:border-neutral-800 dark:hover:border-indigo-600">
      <div className={`tnum text-2xl font-semibold ${t.text}`}>{v}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
        {tone !== "neutral" && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
        {k}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// At-a-glance health so the two quality metrics read instantly, not as bare numbers.
const passTone = (p: number | null): Tone => (p === null ? "neutral" : p >= 80 ? "good" : p >= 50 ? "warn" : "bad");
const flakeTone = (f: number | null): Tone => (f === null ? "neutral" : f <= 5 ? "good" : f <= 15 ? "warn" : "bad");

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
        <Stat v={passRate === null ? "—" : `${passRate}%`} k="latest pass rate" tone={passTone(passRate)} />
        <Stat v={flakeRate === null ? "—" : `${flakeRate}%`} k="latest flake rate" tone={flakeTone(flakeRate)} />
      </div>

      {/* Trend */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Trend (last {r.length} run{r.length === 1 ? "" : "s"})</h2>
          <Link href="/dashboard/trends" className="text-xs text-indigo-600 hover:underline">All trends →</Link>
        </div>
        {r.length < 2 ? (
          <p className="mt-3 text-sm text-neutral-500">Not enough completed runs yet to chart. <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 hover:underline">Set up CI</Link> to start recording.</p>
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
        <Link href={`/dashboard/projects/${projectId}/create`} className="group v-card border border-indigo-300 bg-indigo-50/40 p-5 hover:border-indigo-500 dark:border-indigo-800 dark:bg-indigo-950/20">
          <div className="text-sm font-semibold">＋ Create tests</div>
          <p className="mt-1 text-xs text-neutral-500">UI, API, visual, AI agent, performance or security — pick a type and Verity writes the test.</p>
        </Link>
        <Link href={`/dashboard/projects/${projectId}/ci`} className="group v-card border border-neutral-200 p-5 hover:border-indigo-400 dark:border-neutral-800">
          <div className="text-sm font-semibold">⚙️ Set up CI</div>
          <p className="mt-1 text-xs text-neutral-500">Get the workflow file for GitHub, GitLab or Jenkins. Runs in your CI are unlimited.</p>
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
