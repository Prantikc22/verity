import Link from "next/link";
import type { Metadata } from "next";
import { PerfGenerate } from "../PerfGenerate";
import { CloudTrial } from "../../CloudTrial";

export const metadata: Metadata = { title: "Performance · Configure", robots: { index: false } };

/**
 * Performance configuration lives on its own page: the "what/how" explainer, the
 * one-off cloud trial, and the AI config generator. Results stay on ../performance.
 */
export default async function PerformanceConfigurePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Configure performance testing</h2>
          <p className="text-xs text-neutral-500">Generate load-test configs from your OpenAPI spec, try a quick public-URL trial, and wire it into CI. Results appear under <Link href={`/dashboard/projects/${projectId}/performance`} className="text-indigo-600 underline">Performance → Results</Link>.</p>
        </div>
        <Link href={`/dashboard/projects/${projectId}/ci`} className="shrink-0 border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30">⚙️ Turn on Performance in CI →</Link>
      </div>

      <details className="border border-neutral-200 dark:border-neutral-800" open>
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

      <section className="space-y-3">
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
