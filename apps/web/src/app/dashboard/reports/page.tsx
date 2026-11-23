import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { entitlementsFor } from "@/lib/entitlements";
import { Chip, Empty, KpiStrip, PageHeader, Panel, daysAgoISO, fmtDuration, lastNDays, th, td } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

const RANGES = [7, 14, 30] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ project?: string; days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days) as (typeof RANGES)[number]) ? Number(sp.days) : 14;
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const ent = entitlementsFor(orgCtx?.org);
  const supabase = await createClient();

  const { data: projects } = orgId ? await supabase.from("projects").select("id, name").eq("org_id", orgId).order("name") : { data: [] };
  const projectIds = (projects ?? []).map((p) => p.id).filter((id) => !sp.project || id === sp.project);
  const since = daysAgoISO(days);

  const [{ data: runs }, { data: results }, { data: flaky }] = projectIds.length
    ? await Promise.all([
        supabase.from("test_runs").select("id, total, passed, failed, flaky, duration_ms, created_at").in("project_id", projectIds).eq("status", "completed").gte("created_at", since).limit(3000),
        supabase.from("test_results").select("name, spec_path, status, duration_ms, project_id").in("project_id", projectIds).gte("created_at", since).limit(5000),
        supabase.from("flake_stats").select("test_id, project_id, flaky_total, runs_total, last_flaky_at").in("project_id", projectIds).gt("flaky_total", 0).order("flaky_total", { ascending: false }).limit(8),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const r = runs ?? [];
  const total = r.reduce((n, x) => n + x.total, 0);
  const passed = r.reduce((n, x) => n + x.passed, 0);
  const flakyN = r.reduce((n, x) => n + x.flaky, 0);
  const failedN = r.reduce((n, x) => n + x.failed, 0);
  const durs = r.map((x) => x.duration_ms).filter((d): d is number => !!d).sort((a, b) => a - b);

  // Daily buckets for the trend chart.
  const buckets = lastNDays(days).map((d) => ({ ...d, passed: 0, failed: 0, flaky: 0 }));
  const byDay = new Map(buckets.map((b) => [b.key, b]));
  for (const x of r) { const b = byDay.get(x.created_at.slice(0, 10)); if (b) { b.passed += x.passed; b.failed += x.failed; b.flaky += x.flaky; } }
  const maxDay = Math.max(1, ...buckets.map((b) => b.passed + b.failed + b.flaky));

  // Per-test aggregates from individual results.
  type Agg = { name: string; spec: string; runs: number; fails: number; dur: number[] };
  const agg = new Map<string, Agg>();
  for (const t of results ?? []) {
    const k = `${t.spec_path}::${t.name}`;
    const a: Agg = agg.get(k) ?? { name: t.name ?? t.spec_path ?? "Test", spec: t.spec_path ?? "", runs: 0, fails: 0, dur: [] };
    a.runs += 1; if (t.status === "failed") a.fails += 1; if (t.duration_ms) a.dur.push(t.duration_ms);
    agg.set(k, a);
  }
  const all = [...agg.values()];
  const failing = all.filter((a) => a.fails > 0).sort((a, b) => b.fails / b.runs - a.fails / a.runs).slice(0, 8);
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
  const slowest = all.filter((a) => a.dur.length).sort((a, b) => avg(b.dur) - avg(a.dur)).slice(0, 8);

  const flakyIds = (flaky ?? []).map((f) => f.test_id);
  const { data: flakyTests } = flakyIds.length ? await supabase.from("tests").select("id, name, spec_path").in("id", flakyIds) : { data: [] };
  const tName = new Map((flakyTests ?? []).map((t) => [t.id, t]));
  const pName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const historyDays = ent.reports?.historyDays ?? ent.maxRunHistory;

  const q = (o: { project?: string; days?: number }) => {
    const u = new URLSearchParams();
    const pr = o.project === undefined ? sp.project : o.project;
    if (pr) u.set("project", pr);
    u.set("days", String(o.days ?? days));
    return `/dashboard/reports?${u}`;
  };

  return (
    <>
      <PageHeader title="Reports" lead={<>Test health across runs. Your plan keeps run detail for {historyDays > 9999 ? "unlimited" : historyDays} days; aggregate trends are kept for the life of the project.</>} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
          {RANGES.map((d) => (
            <Link key={d} href={q({ days: d })} aria-current={d === days ? "true" : undefined} className={`rounded px-2.5 py-1 text-[12.5px] ${d === days ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}>{d}d</Link>
          ))}
        </div>
        <div className="inline-flex flex-wrap rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
          <Link href={q({ project: "" })} className={`rounded px-2.5 py-1 text-[12.5px] ${!sp.project ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white" : "text-neutral-600"}`}>All projects</Link>
          {(projects ?? []).map((p) => (
            <Link key={p.id} href={q({ project: p.id })} className={`rounded px-2.5 py-1 text-[12.5px] ${sp.project === p.id ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white" : "text-neutral-600"}`}>{p.name}</Link>
          ))}
        </div>
      </div>

      {r.length === 0 ? (
        <Empty title="No results in this range" body="Add the QAShift step to a pipeline that already runs Playwright. No agent setup needed to get history and flaky-test detection." href="/dashboard/projects" cta="Connect a project" />
      ) : (
        <>
          <KpiStrip items={[
            { label: "Test results", value: total.toLocaleString(), sub: `${r.length} runs` },
            { label: "Pass rate", value: total ? `${((passed / total) * 100).toFixed(1)}%` : "—", tone: total && passed / total >= 0.95 ? "ok" : "warn" },
            { label: "Failed · flaky", value: `${failedN} · ${flakyN}`, tone: failedN ? "bad" : flakyN ? "warn" : "ok" },
            { label: "Median run time", value: fmtDuration(durs.length ? durs[Math.floor(durs.length / 2)] : null) },
          ]} />
          {ent.reports && <p className="mt-2 text-[12px] text-neutral-500">Reports plan: {total.toLocaleString()} of {ent.reports.resultsPerMonth.toLocaleString()} monthly results used in this window.</p>}

          <Panel className="mt-5" title="Results per day" action={<span className="flex gap-3"><Key c="bg-emerald-500" l="passed" /><Key c="bg-amber-400" l="flaky" /><Key c="bg-red-500" l="failed" /></span>}>
            <div role="img" aria-label={`Daily results for the last ${days} days`} className="flex h-40 items-end gap-1">
              {buckets.map((b) => {
                const h = ((b.passed + b.failed + b.flaky) / maxDay) * 100;
                return (
                  <div key={b.key} className="group relative flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${b.passed} passed, ${b.flaky} flaky, ${b.failed} failed`}>
                    <div className="flex w-full flex-col-reverse overflow-hidden rounded-[2px]" style={{ height: `${Math.max(h, b.passed + b.failed + b.flaky ? 3 : 1)}%` }}>
                      <span className="bg-emerald-500" style={{ flex: b.passed }} /><span className="bg-amber-400" style={{ flex: b.flaky }} /><span className="bg-red-500" style={{ flex: b.failed }} />
                      {b.passed + b.failed + b.flaky === 0 && <span className="flex-1 bg-neutral-200 dark:bg-neutral-800" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11.5px] text-neutral-400"><span>{buckets[0].label}</span><span>{buckets[buckets.length - 1].label}</span></div>
          </Panel>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <TestTable title="Flakiest tests" empty="No flaky tests. Failures that pass on retry show up here."
              rows={(flaky ?? []).map((f) => ({ name: tName.get(f.test_id)?.name ?? "Test", sub: `${pName.get(f.project_id) ?? ""} · ${tName.get(f.test_id)?.spec_path ?? ""}`, value: `${Math.round((f.flaky_total / Math.max(1, f.runs_total)) * 100)}%`, note: `${f.flaky_total}/${f.runs_total} runs`, tone: "warn" as const }))} />
            <TestTable title="Most failing tests" empty="No failures in this range."
              rows={failing.map((a) => ({ name: a.name, sub: a.spec, value: `${Math.round((a.fails / a.runs) * 100)}%`, note: `${a.fails}/${a.runs} runs`, tone: "bad" as const }))} />
            <TestTable title="Slowest tests" empty="No timing data yet."
              rows={slowest.map((a) => ({ name: a.name, sub: a.spec, value: fmtDuration(avg(a.dur)), note: `avg of ${a.dur.length}`, tone: "neutral" as const }))} />
            <Panel title="Share a report" action={<Chip tone="neutral">Coming soon</Chip>}>
              <p className="text-[13px] text-neutral-500">Private, expiring links for people outside engineering, plus JUnit upload for any framework. Until then, reports are visible to members of this workspace only.</p>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function Key({ c, l }: { c: string; l: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${c}`} />{l}</span>;
}

function TestTable({ title, rows, empty }: { title: string; empty: string; rows: { name: string; sub: string; value: string; note: string; tone: "warn" | "bad" | "neutral" }[] }) {
  const tone = { warn: "text-amber-700 dark:text-amber-400", bad: "text-red-700 dark:text-red-400", neutral: "text-neutral-900 dark:text-neutral-100" };
  return (
    <Panel title={title} flush>
      {rows.length === 0 ? <p className="p-4 text-[13px] text-neutral-500">{empty}</p> : (
        <table className="w-full text-[13px]">
          <thead className="sr-only"><tr><th className={th}>Test</th><th className={th}>Value</th></tr></thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${td} max-w-0 w-full`}><div className="truncate font-medium">{r.name}</div><div className="truncate font-mono text-[11.5px] text-neutral-500">{r.sub}</div></td>
                <td className={`${td} whitespace-nowrap text-right`}><div className={`tnum font-semibold ${tone[r.tone]}`}>{r.value}</div><div className="text-[11.5px] text-neutral-500">{r.note}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
