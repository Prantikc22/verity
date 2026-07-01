"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CloudTrial({ projectId, discipline }: { projectId: string; discipline: "performance" | "security" }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const label = discipline === "performance" ? "performance smoke" : "security baseline";
  const STEPS = discipline === "performance"
    ? ["Reaching your URL…", "Sending a burst of requests…", "Measuring latency percentiles…", "Crunching the numbers…"]
    : ["Reaching your URL…", "Inspecting security headers…", "Checking HTTPS & exposure…", "Ranking findings…"];
  const [step, setStep] = useState(0);

  async function run() {
    if (!url.trim()) { setErr("Enter a public URL."); return; }
    setBusy(true); setErr(""); setMsg(""); setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    try {
      const res = await fetch(`/api/projects/${projectId}/cloud-trial`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ discipline, url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Trial failed.");
      setMsg("Done — results updated above. This is just a taste; wire your CI for the full, unlimited run.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); } finally { clearInterval(ticker); setBusy(false); }
  }

  return (
    <section className="border border-dashed border-indigo-300 bg-indigo-50/40 p-4 dark:border-indigo-800/60 dark:bg-indigo-950/20">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Try it now — {label} on a public URL</h3>
        <span className="text-[10px] uppercase tracking-wide text-indigo-500">cloud trial</span>
      </div>
      <p className="mt-0.5 text-[11px] text-neutral-500">
        A quick taste on our infra — capped per plan. {discipline === "performance"
          ? <>It sends ~30 requests for a latency feel; <strong>for real load (30+ concurrent users) configure CI</strong> — it runs unlimited and can hit internal targets.</>
          : <>It checks security headers &amp; exposure; the <strong>full scan (deeper, your code + running app) runs in CI</strong>, unlimited.</>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} placeholder="https://your-staging.example.com"
          className="min-w-0 flex-1 border border-neutral-300 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-neutral-700" />
        <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {busy ? "Running…" : "Run trial"}
        </button>
      </div>
      {busy && (
        <div className="mt-3 flex items-center gap-2 border border-indigo-200 bg-white/60 px-3 py-2 text-[11px] text-neutral-600 dark:border-indigo-900/60 dark:bg-neutral-950/40 dark:text-neutral-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          <span>{STEPS[step]}</span>
          <span className="ml-auto text-neutral-400">a few seconds…</span>
        </div>
      )}
      {!busy && msg && <p className="mt-2 text-[11px] text-emerald-600">{msg}</p>}
      {!busy && err && <p className="mt-2 text-[11px] text-red-600">{err}</p>}
    </section>
  );
}
