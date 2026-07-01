import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trends", robots: { index: false } };

interface RunRow {
  created_at: string;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  tier: string;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-10 text-xs text-neutral-400">Not enough data</div>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 28}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-500" />
    </svg>
  );
}

export default async function TrendsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name").order("created_at");

  // Aggregate the most recent 30 runs per project for pass/flake trends.
  const blocks = await Promise.all(
    (projects ?? []).map(async (p) => {
      const { data: runs } = await supabase
        .from("test_runs")
        .select("created_at, total, passed, failed, flaky, tier")
        .eq("project_id", p.id)
        .eq("status", "completed")
        .order("created_at", { ascending: true })
        .limit(30);
      return { project: p, runs: (runs ?? []) as RunRow[] };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
      <p className="mt-1 text-sm text-neutral-500">Pass rate, flake rate, and run volume over time — computed from real runs. Empty until your CI starts reporting.</p>

      {blocks.length === 0 && <p className="mt-8 text-sm text-neutral-500">No projects yet. <Link href="/dashboard" className="text-indigo-600 underline">Create one</Link>.</p>}

      <div className="mt-8 space-y-6">
        {blocks.map(({ project, runs }) => {
          const passRates = runs.map((r) => (r.total ? r.passed / r.total : 0));
          const flakeRates = runs.map((r) => (r.total ? r.flaky / r.total : 0));
          const latest = runs[runs.length - 1];
          return (
            <div key={project.id} className="border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <Link href={`/dashboard/projects/${project.id}`} className="font-medium hover:opacity-80">{project.name}</Link>
                <span className="text-xs text-neutral-400">{runs.length} run{runs.length === 1 ? "" : "s"}</span>
              </div>
              {runs.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-500">No completed runs yet.</p>
              ) : (
                <div className="mt-4 grid gap-6 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-neutral-500">Pass rate</div>
                    <div className="text-xl font-semibold">{latest && latest.total ? Math.round((latest.passed / latest.total) * 100) : 0}%</div>
                    <Sparkline values={passRates} />
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">Flake rate</div>
                    <div className="text-xl font-semibold">{latest && latest.total ? Math.round((latest.flaky / latest.total) * 100) : 0}%</div>
                    <Sparkline values={flakeRates} />
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">Tests / run</div>
                    <div className="text-xl font-semibold">{latest?.total ?? 0}</div>
                    <Sparkline values={runs.map((r) => r.total)} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
