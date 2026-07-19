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
          <p><strong>This is a load test for your API</strong>, not a website crawler. It doesn&apos;t spider every page — it generates concurrent traffic against the <em>endpoints and flows you define</em> (Verity builds these from your OpenAPI spec) and measures how they hold up under load: latency percentiles (p50/p95/p99) and error rate. It does smoke, load, stress, spike, soak, and breakpoint testing via the <em>profile</em> you pick; it is not a functional/correctness test (your Playwright API tests cover that).</p>
          <p><strong>Front-end vs back-end:</strong> the load test measures <em>server</em> performance. For <em>page-load</em> performance (the “whole page feels slow” problem), enable <strong>Core Web Vitals</strong> — that&apos;s the front-end half.</p>
          <div className="border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-medium text-neutral-700 dark:text-neutral-300">Key terms</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong>VU (virtual user)</strong> — one simulated user running the scenario (e.g. “list products → open one”). <strong>Peak VUs</strong> is your load knob: more VUs = more concurrency.</li>
              <li><strong>duration</strong> — how long the steady phase holds at peak (seconds).</li>
              <li><strong>profile</strong> — the <em>shape</em> of the load. One generated script runs them all; pick at run time with <code>-e PROFILE=…</code>.</li>
              <li><strong>p95 / p99</strong> — 95%/99% of requests were faster than this. Watch p95 — it reflects your slowest real users far better than the average.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-neutral-700 dark:text-neutral-300">The profiles — pick by the question you’re asking</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong>smoke</strong> (every PR) — 1–2 VUs, ~30s. Catches “this PR made the API 5× slower,” not capacity. Never read it as a load test.</li>
              <li><strong>load</strong> (merge) — ramp to your real peak and hold. Does it hold up at normal traffic? Set Peak VUs near your true peak concurrency.</li>
              <li><strong>stress</strong> — push well past peak to find where p95/errors start climbing (the degradation point).</li>
              <li><strong>spike</strong> — a sudden burst then drop; does it survive a flash crowd and recover?</li>
              <li><strong>soak</strong> — moderate load held for a long run; surfaces leaks and slow drift.</li>
              <li><strong>breakpoint</strong> — ramp with no cap until it breaks; finds the exact ceiling.</li>
            </ul>
            <p className="mt-2"><strong>Healthy targets:</strong> error rate &lt; 1%, and p95 stable as load rises. If p95 climbs steeply while VUs are flat, you’ve found a bottleneck. One CI runner tops out around a few hundred req/s — past that you’re measuring the runner, not your API.</p>
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
