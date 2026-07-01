"use client";

import { useState } from "react";
import Link from "next/link";

export function PerfGenerate({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [specUrl, setSpecUrl] = useState("");
  const [spec, setSpec] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [smoke, setSmoke] = useState(true);
  const [full, setFull] = useState(true);
  const [arrivalRate, setArrivalRate] = useState(10);
  const [durationSec, setDurationSec] = useState(120);
  const [rampTo, setRampTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState<{ spec_path: string }[] | null>(null);

  async function submit() {
    if (!baseUrl.trim()) { setMsg("Base URL is required."); return; }
    if (!smoke && !full) { setMsg("Pick at least one tier."); return; }
    setBusy(true); setMsg(""); setSaved(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/perf-tests`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(), spec: spec.trim() || undefined, specUrl: specUrl.trim() || undefined,
          smoke, full, load: full ? { durationSec, arrivalRate, rampToRate: rampTo ? Number(rampTo) : undefined } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setSaved(data.saved ?? []);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed."); } finally { setBusy(false); }
  }

  return (
    <section className="border border-neutral-200 dark:border-neutral-800">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3 text-left">
        <span className="text-sm font-semibold">Generate load-test configs <span className="font-normal text-neutral-400">— from your OpenAPI spec</span></span>
        <span className="text-neutral-400">{open ? "−" : "＋"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-200 p-5 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Reuses the same spec as your API tests. Generates a light <strong>smoke</strong> config (every PR) and/or a <strong>load</strong> config (merge), saved under <code>tests/verity/perf/</code>.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-[11px] font-medium">OpenAPI spec URL</span>
              <input value={specUrl} onChange={(e) => setSpecUrl(e.target.value)} placeholder="https://api.example.com/openapi.json" className="mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" /></label>
            <label className="block"><span className="text-[11px] font-medium">Base URL (target) *</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://staging.example.com" className="mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" /></label>
          </div>
          <label className="block"><span className="text-[11px] font-medium">…or paste the spec</span>
            <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} placeholder="Paste OpenAPI JSON/YAML" className="mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 font-mono text-[11px] outline-none focus:border-indigo-500 dark:border-neutral-700" /></label>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={smoke} onChange={(e) => setSmoke(e.target.checked)} /> Smoke (PR)</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Full load (merge)</label>
            {full && <>
              <label className="flex items-center gap-1.5">VUs/sec <input type="number" value={arrivalRate} onChange={(e) => setArrivalRate(Number(e.target.value))} className="w-16 border border-neutral-300 bg-transparent px-1.5 py-1 dark:border-neutral-700" /></label>
              <label className="flex items-center gap-1.5">Duration s <input type="number" value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} className="w-16 border border-neutral-300 bg-transparent px-1.5 py-1 dark:border-neutral-700" /></label>
              <label className="flex items-center gap-1.5">Ramp to <input type="number" value={rampTo} onChange={(e) => setRampTo(e.target.value)} placeholder="opt" className="w-16 border border-neutral-300 bg-transparent px-1.5 py-1 dark:border-neutral-700" /></label>
            </>}
          </div>
          {msg && <p className="text-xs text-red-600">{msg}</p>}
          {saved && (
            <div className="border border-emerald-200 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="font-medium text-emerald-700 dark:text-emerald-300">✓ Generated {saved.length} config file{saved.length === 1 ? "" : "s"}</p>
              <ul className="mt-1 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">{saved.map((s) => <li key={s.spec_path}>{s.spec_path}</li>)}</ul>
              <p className="mt-2 font-medium text-neutral-700 dark:text-neutral-300">What happens next</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-neutral-600 dark:text-neutral-400">
                <li>The configs are saved to this project (visible under your tests).</li>
                <li><strong>Commit them to your repo</strong> — push via the GitHub App, or copy them into <code>tests/verity/perf/</code>.</li>
                <li>Enable <strong>Performance</strong> in <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 underline">CI Setup</Link> and add the config to your workflow.</li>
                <li>On the next PR/merge the smoke/load test runs and posts results here.</li>
              </ol>
            </div>
          )}
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {busy ? "Generating…" : "Generate configs →"}
          </button>
        </div>
      )}
    </section>
  );
}
