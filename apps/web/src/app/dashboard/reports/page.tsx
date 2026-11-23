import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { entitlementsFor } from "@/lib/entitlements";
import { Card, Empty, PageHeader, Stat, StatusPill, daysAgoISO } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

export default async function ReportsPage() {
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const ent = entitlementsFor(orgCtx?.org);
  const supabase = await createClient();

  const since = daysAgoISO(30);
  const [{ data: runs }, { data: projects }] = orgId
    ? await Promise.all([
        supabase.from("test_runs").select("total, passed, failed, flaky, duration_ms").eq("org_id", orgId).eq("status", "completed").gte("created_at", since).limit(2000),
        supabase.from("projects").select("id, name").eq("org_id", orgId),
      ])
    : [{ data: [] }, { data: [] }];

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: flaky } = projectIds.length
    ? await supabase.from("flake_stats").select("test_id, project_id, flaky_total, runs_total, last_flaky_at").in("project_id", projectIds).gt("flaky_total", 0).order("flaky_total", { ascending: false }).limit(10)
    : { data: [] };
  const testIds = (flaky ?? []).map((f) => f.test_id);
  const { data: testNames } = testIds.length ? await supabase.from("tests").select("id, name, spec_path").in("id", testIds) : { data: [] };
  const tName = new Map((testNames ?? []).map((t) => [t.id, t]));
  const pName = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const r = runs ?? [];
  const results = r.reduce((n, x) => n + x.total, 0);
  const passed = r.reduce((n, x) => n + x.passed, 0);
  const flakyCount = r.reduce((n, x) => n + x.flaky, 0);
  const durations = r.map((x) => x.duration_ms).filter((d): d is number => !!d).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  const historyDays = ent.reports?.historyDays ?? ent.maxRunHistory;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Reports" lead={<>Results from every run over the last 30 days. Your plan keeps run details for {historyDays > 9999 ? "unlimited" : `${historyDays}`} days.</>} action={<Link href="/dashboard/trends" className="rounded-full border border-[#D6D1C2] px-4 py-2 text-sm font-medium dark:border-neutral-700">Per-project trends →</Link>} />

      {r.length === 0 ? (
        <Empty title="No results yet" body="Add the QAShift CLI or GitHub Action to an existing Playwright suite to see history and flaky tests here. No agent setup needed." href="/dashboard/projects" cta="Connect a project" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat value={results.toLocaleString()} label="test results (30 days)" />
            <Stat value={results ? `${((passed / results) * 100).toFixed(1)}%` : "—"} label="pass rate" />
            <Stat value={flakyCount.toLocaleString()} label="flaky results" />
            <Stat value={median ? `${Math.round(median / 1000)}s` : "—"} label="median run time" />
          </div>
          {ent.reports && <p className="mt-3 text-xs text-neutral-500">Reports plan: {results.toLocaleString()} of {ent.reports.resultsPerMonth.toLocaleString()} results used in the last 30 days.</p>}

          <h2 className="mt-10 text-sm font-medium text-neutral-500">Flakiest tests</h2>
          {!flaky || flaky.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No flaky tests detected. Failures that pass on retry show up here.</p>
          ) : (
            <Card className="mt-3 p-0">
              <ul className="divide-y divide-[#E6E2D6] dark:divide-neutral-800">
                {flaky.map((f) => {
                  const t = tName.get(f.test_id);
                  const rate = f.runs_total ? Math.round((f.flaky_total / f.runs_total) * 100) : 0;
                  return (
                    <li key={f.test_id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t?.name ?? "Test"}</div>
                        <div className="truncate font-mono text-xs text-neutral-500">{pName.get(f.project_id)} · {t?.spec_path}</div>
                      </div>
                      <span className="tnum shrink-0 rounded-full bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-300">{rate}% flaky · {f.flaky_total}/{f.runs_total}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      <Card className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Shareable report links</span><StatusPill status="roadmap" /></div>
        <p className="mt-1 text-sm text-neutral-500">Private, expiring links for people outside engineering. JUnit upload for any framework is also on the way.</p>
      </Card>
    </div>
  );
}
