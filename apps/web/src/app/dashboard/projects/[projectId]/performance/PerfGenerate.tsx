"use client";

import { useState } from "react";
import Link from "next/link";
import { PERF_PROFILES } from "@qashift/verity-core";

export function PerfGenerate({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [specUrl, setSpecUrl] = useState("");
  const [spec, setSpec] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [vus, setVus] = useState(10);
  const [durationSec, setDurationSec] = useState(120);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState<{ spec_path: string }[] | null>(null);

  async function submit() {
    if (!baseUrl.trim()) { setMsg("Base URL is required."); return; }
    setBusy(true); setMsg(""); setSaved(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/perf-tests`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(), spec: spec.trim() || undefined, specUrl: specUrl.trim() || undefined,
          vus, durationSec,
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
        <span className="text-sm font-semibold">Generate a load-test suite <span className="font-normal text-neutral-400">— one script, every profile</span></span>
        <span className="text-neutral-400">{open ? "−" : "＋"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-neutral-200 p-5 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Reuses the same OpenAPI spec as your API tests. Generates <strong>one</strong> script at <code>tests/verity/perf/verity.k6.js</code> that runs every profile below — pick the profile at run time (<code>PROFILE=spike</code>). You own and commit the script.</p>

          {/* Profiles the generated suite supports */}
          <div className="grid gap-2 sm:grid-cols-2">
            {PERF_PROFILES.map((p) => (
              <div key={p.profile} className="flex items-start gap-2 border border-neutral-100 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900">
                <span className="mt-0.5 inline-block shrink-0 rounded-sm bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{p.label}</span>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400">{p.question}</p>
                  {p.tier === "fast" && <p className="text-[10px] text-emerald-600">runs automatically on every PR</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-[11px] font-medium">OpenAPI spec URL</span>
              <input value={specUrl} onChange={(e) => setSpecUrl(e.target.value)} placeholder="https://api.example.com/openapi.json" className="mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" /></label>
            <label className="block"><span className="text-[11px] font-medium">Base URL (target) *</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://staging.example.com" className="mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" /></label>
          </div>
          <label className="block"><span className="text-[11px] font-medium">…or paste the spec</span>
            <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} placeholder="Paste OpenAPI JSON/YAML" className="mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 font-mono text-[11px] outline-none focus:border-indigo-500 dark:border-neutral-700" /></label>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5">Peak VUs <input type="number" value={vus} onChange={(e) => setVus(Number(e.target.value))} className="w-16 border border-neutral-300 bg-transparent px-1.5 py-1 dark:border-neutral-700" /></label>
            <label className="flex items-center gap-1.5">Steady duration (s) <input type="number" value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} className="w-20 border border-neutral-300 bg-transparent px-1.5 py-1 dark:border-neutral-700" /></label>
            <span className="text-neutral-400">baked as defaults — override any run with <code>-e VUS=… -e DURATION=…</code></span>
          </div>

          {msg && <p className="text-xs text-red-600 dark:text-red-400">{msg}</p>}
          {saved && (
            <div className="border border-emerald-200 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="font-medium text-emerald-700 dark:text-emerald-300">✓ Generated your k6 suite</p>
              <ul className="mt-1 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">{saved.map((s) => <li key={s.spec_path}>{s.spec_path}</li>)}</ul>
              <p className="mt-2 font-medium text-neutral-700 dark:text-neutral-300">What happens next</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-neutral-600 dark:text-neutral-400">
                <li>The script is saved to this project (visible under your tests).</li>
                <li><strong>Commit it to your repo</strong> — push via the GitHub App, or copy it into <code>tests/verity/perf/</code>.</li>
                <li>Run any profile locally: <code>verity perf --profile spike</code> — or enable <strong>Performance</strong> in <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 underline dark:text-indigo-400">CI Setup</Link> (smoke on PRs, your chosen profile on merge).</li>
                <li>Results post back here.</li>
              </ol>
            </div>
          )}
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {busy ? "Generating…" : "Generate suite →"}
          </button>
        </div>
      )}
    </section>
  );
}
