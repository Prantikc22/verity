import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { PerfMetrics } from "@qashift/verity-core";

export const metadata: Metadata = { title: "Performance", robots: { index: false } };

function ms(v: number | null | undefined): string { return v == null ? "—" : `${Math.round(v)} ms`; }

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={pts} fill="none" className="stroke-indigo-500" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default async function PerformancePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("perf_reports")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);

  const artillery = (reports ?? []).filter((r) => r.engine === "artillery");
  const lighthouse = (reports ?? []).filter((r) => r.engine === "lighthouse");
  const latest = artillery[0];
  const agg = latest ? (latest.aggregate as unknown as PerfMetrics) : null;
  // p95 trend, oldest→newest
  const p95Trend = [...artillery].reverse().map((r) => (r.aggregate as unknown as PerfMetrics).p95 ?? 0).filter((n) => n > 0);
  const lhLatest = lighthouse[0]?.web_vitals as undefined | { performanceScore?: number; lcp?: number; cls?: number; tbt?: number };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Performance</h2>
          <p className="text-xs text-neutral-500">Latency percentiles + error rates from load tests, and Core Web Vitals for page-load — posted from your CI.</p>
        </div>
        <Link href={`/dashboard/projects/${projectId}/performance/configure`} className="shrink-0 border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30">⚙️ Configure →</Link>
      </div>

      {!latest && !lhLatest ? (
        <div className="border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">No performance results yet.</p>
          <p className="mt-1 text-xs text-neutral-400">Head to <Link href={`/dashboard/projects/${projectId}/performance/configure`} className="text-indigo-600 underline">Configure</Link> to generate a load-test config, run a quick trial, or wire CI — results will appear here.</p>
        </div>
      ) : (
        <>
          {latest && agg && (
            <section className="border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{latest.tier === "fast" ? "Perf smoke check" : "Full load test"} <span className="font-normal text-neutral-400">· latest</span></h3>
                <span className="text-[11px] text-neutral-400">{new Date(latest.created_at).toLocaleString()}</span>
              </div>
              {latest.tier === "fast" && <p className="mt-1 text-[11px] text-amber-600">Smoke check — a light sanity check, not a full load test.</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { l: "Requests", v: String(agg.requests) },
                  { l: "Error rate", v: `${(agg.errorRate * 100).toFixed(1)}%`, bad: agg.errorRate > 0.05 },
                  { l: "p50", v: ms(agg.p50) },
                  { l: "p95", v: ms(agg.p95) },
                  { l: "p99", v: ms(agg.p99) },
                  { l: "Throughput", v: agg.rps != null ? `${Math.round(agg.rps)}/s` : "—" },
                ].map((m) => (
                  <div key={m.l} className="border border-neutral-200 p-3 dark:border-neutral-800">
                    <div className="text-[10px] uppercase tracking-wide text-neutral-400">{m.l}</div>
                    <div className={`tnum mt-1 text-lg font-semibold ${m.bad ? "text-red-600" : ""}`}>{m.v}</div>
                  </div>
                ))}
              </div>
              {p95Trend.length >= 2 && (
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-wide text-neutral-400">p95 latency over time</div>
                  <Sparkline values={p95Trend} />
                </div>
              )}
            </section>
          )}

          {lhLatest && (
            <section className="border border-neutral-200 p-5 dark:border-neutral-800">
              <h3 className="text-sm font-semibold">Core Web Vitals <span className="font-normal text-neutral-400">· page-load</span></h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { l: "Performance", v: lhLatest.performanceScore != null ? String(lhLatest.performanceScore) : "—" },
                  { l: "LCP", v: ms(lhLatest.lcp) },
                  { l: "CLS", v: lhLatest.cls != null ? lhLatest.cls.toFixed(2) : "—" },
                  { l: "TBT", v: ms(lhLatest.tbt) },
                ].map((m) => (
                  <div key={m.l} className="border border-neutral-200 p-3 dark:border-neutral-800">
                    <div className="text-[10px] uppercase tracking-wide text-neutral-400">{m.l}</div>
                    <div className="mt-1 text-lg font-semibold">{m.v}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold">Recent runs</h3>
            <div className="mt-2 overflow-x-auto border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-900"><tr>
                  <th className="px-3 py-2">When</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Requests</th><th className="px-3 py-2 text-right">Errors</th><th className="px-3 py-2 text-right">p95</th><th className="px-3 py-2 text-right">p99</th>
                </tr></thead>
                <tbody>
                  {artillery.slice(0, 15).map((r) => {
                    const a = r.aggregate as unknown as PerfMetrics;
                    return (
                      <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800/60">
                        <td className="px-3 py-2 text-neutral-500">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{r.tier === "fast" ? "Smoke" : "Load"}</td>
                        <td className="px-3 py-2 text-right">{a.requests}</td>
                        <td className={`px-3 py-2 text-right ${a.errorRate > 0.05 ? "text-red-600" : ""}`}>{(a.errorRate * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">{ms(a.p95)}</td>
                        <td className="px-3 py-2 text-right">{ms(a.p99)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

    </div>
  );
}
