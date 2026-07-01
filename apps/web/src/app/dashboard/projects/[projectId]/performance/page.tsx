import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { PerfMetrics } from "@qashift/verity-core";
import { PerfGenerate } from "./PerfGenerate";
import { CloudTrial } from "../CloudTrial";

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
        <Link href={`/dashboard/projects/${projectId}/ci`} className="shrink-0 border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30">⚙️ Turn on Performance in CI →</Link>
      </div>

      <details className="border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">What this measures &amp; how to configure it <span className="font-normal text-neutral-400">— read me first</span></summary>
        <div className="space-y-3 border-t border-neutral-200 p-5 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <p><strong>This is a load test for your API</strong>, not a website crawler. It doesn&apos;t spider every page — it generates concurrent traffic against the <em>endpoints and flows you define</em> (Verity builds these from your OpenAPI spec) and measures how they hold up under load: latency percentiles (p50/p95/p99) and error rate. It does load, smoke, soak, and spike testing by shaping the <em>phases</em>; it is not a functional/correctness test (your Playwright API tests cover that).</p>
          <p><strong>Front-end vs back-end:</strong> the load test measures <em>server</em> performance. For <em>page-load</em> performance (the “whole page feels slow” problem), enable <strong>Core Web Vitals</strong> — that&apos;s the front-end half.</p>
          <div className="border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-medium text-neutral-700 dark:text-neutral-300">Key terms</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong>VU (virtual user)</strong> — one simulated user running a scenario (e.g. “log in → list orders”). More VUs = more concurrency.</li>
              <li><strong>arrivalRate</strong> — how many <em>new</em> VUs start <em>per second</em>. This is your load knob. arrivalRate 10 for 60s ≈ 600 sessions begun over the minute.</li>
              <li><strong>duration</strong> — how long a phase runs (seconds).</li>
              <li><strong>ramp (rampTo)</strong> — gradually increase arrivalRate from start→rampTo, so you find the breaking point instead of slamming cold.</li>
              <li><strong>p95 / p99</strong> — 95%/99% of requests were faster than this. Watch p95 — it reflects the experience of your slowest real users far better than the average.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-neutral-700 dark:text-neutral-300">How to set it optimally</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong>Smoke (every PR):</strong> keep it tiny — arrivalRate 1–2, duration ~30s. It catches “this PR made the API 5× slower,” not capacity. Never read it as a load test.</li>
              <li><strong>Full load (merge):</strong> start near your real peak traffic. Don&apos;t know it? Set arrivalRate to ~2× your average requests/sec and <em>ramp</em> over 1–2 min to find where p95 spikes or errors climb.</li>
              <li><strong>Healthy targets:</strong> error rate &lt; 1%, and p95 stable as load rises. If p95 climbs steeply while arrivalRate is flat, you&apos;ve found a bottleneck.</li>
              <li><strong>One CI runner caps out around a few hundred req/s.</strong> Need more? Turn on <em>distributed</em> mode — otherwise you&apos;re measuring the runner, not your API.</li>
            </ul>
          </div>
        </div>
      </details>

      {!latest && !lhLatest ? (
        <div className="border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">No performance results yet.</p>
          <p className="mt-1 text-xs text-neutral-400">Run a <strong>quick trial</strong> or set up <strong>CI</strong> below — results will appear here.</p>
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

      {/* ── Setup: clearly separated from results, with the two paths explained ── */}
      <section className="space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-semibold">Add results — two ways</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            <strong>Quick trial</strong> just pings a <em>public URL</em> for an instant latency taste (capped, runs on our infra).
            <strong> Set up in CI</strong> builds a real load test from your <em>OpenAPI spec</em> — it exercises your actual endpoints and runs <strong>unlimited</strong> in your pipeline. That&apos;s why the trial asks for a URL and CI asks for a spec.
          </p>
        </div>
        <CloudTrial projectId={projectId} discipline="performance" />
        <PerfGenerate projectId={projectId} />
      </section>
    </div>
  );
}
