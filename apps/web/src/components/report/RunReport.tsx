"use client";

import { useMemo, useState } from "react";
import type { ReportRow, RunReportData, Status } from "@/lib/reports/run-report";

/* ------------------------------------------------------------------ *
 * The run report. Built to answer, in this order:
 *   1. Can I ship?           (verdict, pass rate, what changed)
 *   2. What broke and why?   (failures grouped by root cause, full errors)
 *   3. Is it real?           (attempts, flake history, failing since when)
 *   4. How do I reproduce?   (one command, copied)
 * ------------------------------------------------------------------ */

const fmt = (ms: number | null | undefined) => {
  if (ms == null) return "—";
  if (ms >= 60000) return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
};
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
const TONE: Record<Status, { dot: string; text: string; bg: string; label: string }> = {
  failed: { dot: "bg-red-500", text: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", label: "Failed" },
  flaky: { dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", label: "Flaky" },
  passed: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", label: "Passed" },
  healed: { dot: "bg-violet-500", text: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-950/40", label: "Self-healed" },
  skipped: { dot: "bg-neutral-300", text: "text-neutral-500", bg: "bg-neutral-100 dark:bg-neutral-800", label: "Skipped" },
};
const ORDER: Record<Status, number> = { failed: 0, flaky: 1, healed: 2, passed: 3, skipped: 4 };

type Tab = "failed" | "flaky" | "passed" | "all" | "slowest";

function Ring({ pct }: { pct: number }) {
  const r = 30, c = 2 * Math.PI * r;
  const tone = pct >= 99 ? "#22C985" : pct >= 90 ? "#E9A23B" : "#E5484D";
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-neutral-200 dark:text-neutral-800" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 38 38)" />
      <text x="38" y="42" textAnchor="middle" className="fill-neutral-900 text-[15px] font-semibold dark:fill-white">{Math.round(pct)}%</text>
    </svg>
  );
}

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); } catch { /* blocked */ } }}
      className="rounded-md border border-neutral-300 px-2 py-0.5 text-[11.5px] text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300">
      {ok ? "Copied" : label}
    </button>
  );
}

/** Colour Playwright's Expected/Received lines so the difference jumps out. */
function ErrorBlock({ text }: { text: string }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-neutral-950 p-3 text-[12px] leading-relaxed text-neutral-200">
      {text.split("\n").map((l, i) => {
        const cls = /^\s*Expected/.test(l) ? "text-emerald-400" : /^\s*Received/.test(l) ? "text-red-400" : /^\s*(Locator|Call log)/.test(l) ? "text-sky-300" : /^\s*-\s/.test(l) ? "text-neutral-400" : "";
        return <div key={i} className={cls}>{l || " "}</div>;
      })}
    </pre>
  );
}

function HistoryStrip({ row }: { row: ReportRow }) {
  const max = Math.max(1, ...row.history.map((h) => h.ms ?? 0));
  return (
    <div>
      <div className="flex items-end gap-[3px]" aria-label={`Last ${row.history.length} runs`}>
        {row.history.map((h, i) => (
          <span key={i} title={`${TONE[h.status]?.label ?? h.status} · ${fmt(h.ms)} · ${ago(h.at)}`}
            className={`w-2.5 rounded-sm ${TONE[h.status]?.dot ?? "bg-neutral-300"} ${h.current ? "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white dark:ring-offset-neutral-900" : "opacity-80"}`}
            style={{ height: `${10 + Math.round(((h.ms ?? 0) / max) * 22)}px` }} />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">Last {row.history.length} run{row.history.length === 1 ? "" : "s"}, oldest to newest. Height is duration.</p>
    </div>
  );
}

function Detail({ row }: { row: ReportRow }) {
  const d = row.details;
  const attempts = d?.attempts?.length ? d.attempts : null;
  const repro = row.location ? `npx playwright test ${row.location}` : `npx playwright test ${row.file} -g "${row.name.split(" › ").pop()}"`;
  const [showStack, setShowStack] = useState(false);
  const fullError = attempts?.find((a) => !a.ok && a.error)?.error ?? row.error;
  return (
    <div className="grid gap-4 border-t border-neutral-100 bg-neutral-50/60 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950/40 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-3">
        {row.explanation && row.status !== "passed" && row.explanation.trim() !== (row.error ?? "").split("\n")[0].trim() && (
          <p className="text-[13px] text-neutral-700 dark:text-neutral-300"><b className={TONE[row.status].text}>In plain English: </b>{row.explanation}</p>
        )}
        {row.healed && <p className="rounded-md border-l-2 border-violet-500 bg-violet-50 px-3 py-2 text-[13px] text-violet-800 dark:bg-violet-950/30 dark:text-violet-200"><b>Self-healed:</b> {row.healed}</p>}
        {d?.step && <p className="text-[13px]"><span className="text-neutral-500">Failed at step </span><b>{d.step}</b></p>}

        {attempts && (
          <div>
            <p className="mb-1.5 text-[11.5px] font-medium text-neutral-500">Attempts</p>
            <ol className="flex flex-wrap gap-1.5">
              {attempts.map((a, i) => (
                <li key={i} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${a.ok ? TONE.passed.bg : TONE.failed.bg}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${a.ok ? TONE.passed.dot : TONE.failed.dot}`} />
                  <span className={a.ok ? TONE.passed.text : TONE.failed.text}>Attempt {i + 1} {a.ok ? "passed" : "failed"}</span>
                  <span className="text-neutral-500">{fmt(a.ms)}</span>
                </li>
              ))}
            </ol>
            {row.status === "flaky" && <p className="mt-1.5 text-[12px] text-amber-700 dark:text-amber-400">Failed, then passed on retry. Counted as flaky, not as a pass, so it doesn&apos;t hide.</p>}
          </div>
        )}

        {fullError && (
          <div>
            <div className="mb-1.5 flex items-center justify-between"><p className="text-[11.5px] font-medium text-neutral-500">Error</p><Copy text={fullError} label="Copy error" /></div>
            <ErrorBlock text={fullError} />
            {d?.stack && (
              <button type="button" onClick={() => setShowStack((v) => !v)} className="mt-1.5 text-[12px] text-neutral-500 underline">{showStack ? "Hide" : "Show"} stack trace</button>
            )}
            {showStack && d?.stack && <pre className="mt-1.5 max-h-60 overflow-auto rounded-lg bg-neutral-900 p-3 text-[11px] text-neutral-400">{d.stack}</pre>}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[11.5px] font-medium text-neutral-500">Reproduce on your machine</p>
          <div className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-neutral-100">{repro}</code>
            <Copy text={repro} />
          </div>
        </div>

        {row.plan.length > 0 && (
          <div>
            <p className="mb-1 text-[11.5px] font-medium text-neutral-500">What this test does</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-[13px] text-neutral-700 dark:text-neutral-300">{row.plan.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        )}
      </div>

      <aside className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <HistoryStrip row={row} />
        <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div><dt className="text-neutral-500">Flake rate</dt><dd className="font-semibold">{row.flakeRate == null ? "—" : `${Math.round(row.flakeRate * 100)}%`}</dd></div>
          <div><dt className="text-neutral-500">This run</dt><dd className="font-semibold">{fmt(row.durationMs)}</dd></div>
          <div><dt className="text-neutral-500">Usual time</dt><dd className="font-semibold">{fmt(row.medianMs)}</dd></div>
          <div><dt className="text-neutral-500">Attempts</dt><dd className="font-semibold">{row.attempts}</dd></div>
        </dl>
        {row.failingSince && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-800 dark:bg-red-950/40 dark:text-red-300">
            {row.failingSince.runs === 1 ? "First failure in the recorded history" : `Failing for ${row.failingSince.runs} runs in a row`}, since {row.failingSince.commit ? <code className="font-mono">{row.failingSince.commit.slice(0, 7)}</code> : "this run"} ({ago(row.failingSince.at)}).
          </p>
        )}
        {d?.tags && d.tags.length > 0 && <div className="flex flex-wrap gap-1">{d.tags.map((t) => <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{t}</span>)}</div>}
        {d?.project && <p className="text-[12px] text-neutral-500">Browser project: <b className="text-neutral-700 dark:text-neutral-200">{d.project}</b></p>}
      </aside>
    </div>
  );
}

export function RunReport({ data }: { data: RunReportData }) {
  const { run, rows, previous, fixed, clusters } = data;
  const counts = useMemo(() => ({ failed: rows.filter((r) => r.status === "failed").length, flaky: rows.filter((r) => r.status === "flaky").length, passed: rows.filter((r) => r.status === "passed" || r.status === "healed").length }), [rows]);
  const [tab, setTab] = useState<Tab>(counts.failed ? "failed" : counts.flaky ? "flaky" : "all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [only, setOnly] = useState<string[] | null>(null);
  const [onlyLabel, setOnlyLabel] = useState("");

  const executed = rows.length;
  const pct = executed ? ((counts.passed + counts.flaky) / executed) * 100 : 100;
  const newFailures = rows.filter((r) => r.change === "new-failure");
  const newlyFlaky = rows.filter((r) => r.change === "newly-flaky");
  const slower = rows.filter((r) => r.change === "slower");
  const verdict = counts.failed ? { t: `${counts.failed} failing test${counts.failed === 1 ? "" : "s"}: not safe to merge`, c: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" }
    : counts.flaky ? { t: `All tests passed, ${counts.flaky} only on retry`, c: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" }
    : { t: "All tests passed. Safe to merge.", c: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" };
  const m = run.meta;
  const repoUrl = m?.repo ? `https://github.com/${m.repo}` : null;
  const slowest = [...rows].sort((a, b) => b.durationMs - a.durationMs)[0];

  const list = useMemo(() => {
    let xs = rows;
    if (only) xs = xs.filter((r) => only.includes(r.id));
    else if (tab === "failed") xs = xs.filter((r) => r.status === "failed");
    else if (tab === "flaky") xs = xs.filter((r) => r.status === "flaky");
    else if (tab === "passed") xs = xs.filter((r) => r.status === "passed" || r.status === "healed");
    const s = q.trim().toLowerCase();
    if (s) xs = xs.filter((r) => `${r.name} ${r.file} ${r.error ?? ""}`.toLowerCase().includes(s));
    if (tab === "slowest" && !only) return [...xs].sort((a, b) => b.durationMs - a.durationMs).slice(0, 25);
    return [...xs].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
  }, [rows, tab, q, only]);
  const grouped = useMemo(() => {
    if (tab === "slowest" && !only) return [["", list] as const];
    const g = new Map<string, ReportRow[]>();
    for (const r of list) g.set(r.file, [...(g.get(r.file) ?? []), r]);
    return [...g.entries()];
  }, [list, tab, only]);

  const focus = (ids: string[], label: string) => { setOnly(ids); setOnlyLabel(label); setOpen(ids.length === 1 ? ids[0] : null); };

  return (
    <div className="space-y-5">
      {/* 1 · Verdict */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-5">
          <Ring pct={pct} />
          <div className="min-w-0 flex-1">
            <p className={`inline-flex rounded-full border px-3 py-1 text-[13px] font-medium ${verdict.c}`}>{verdict.t}</p>
            <p className="mt-2 text-[13.5px] text-neutral-600 dark:text-neutral-300">
              <b className="text-neutral-900 dark:text-white">{executed}</b> tests · <span className="text-red-600">{counts.failed} failed</span> · <span className="text-amber-600">{counts.flaky} flaky</span> · <span className="text-emerald-600">{counts.passed} passed</span>{run.skipped ? <> · {run.skipped} skipped</> : null}
              {" · "}ran in <b>{fmt(m?.wall_ms ?? run.durationMs)}</b>{slowest && slowest.durationMs > 0 ? <> · slowest <button type="button" className="underline decoration-dotted" onClick={() => focus([slowest.id], "Slowest test")}>{slowest.name.split(" › ").pop()}</button> ({fmt(slowest.durationMs)})</> : null}
            </p>
            {m?.commit_message && <p className="mt-1 truncate text-[13px] text-neutral-500">“{m.commit_message}”{m.author ? ` · ${m.author}` : ""}</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
          {run.branch && <span className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">Branch <b>{run.branch}</b></span>}
          {run.commit && run.commit !== "unknown" && (repoUrl
            ? <a href={`${repoUrl}/commit/${run.commit}`} target="_blank" rel="noreferrer" className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono hover:underline dark:bg-neutral-800">{run.commit.slice(0, 7)} ↗</a>
            : <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono dark:bg-neutral-800">{run.commit.slice(0, 7)}</span>)}
          {run.pr && (repoUrl ? <a href={`${repoUrl}/pull/${run.pr}`} target="_blank" rel="noreferrer" className="rounded-full bg-neutral-100 px-2.5 py-1 hover:underline dark:bg-neutral-800">PR #{run.pr} ↗</a> : <span className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">PR #{run.pr}</span>)}
          {m?.ci_url && <a href={m.ci_url} target="_blank" rel="noreferrer" className="rounded-full bg-neutral-100 px-2.5 py-1 hover:underline dark:bg-neutral-800">CI logs ↗</a>}
          {m?.playwright && <span className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">Playwright {m.playwright}</span>}
          {m?.workers && <span className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">{m.workers} workers</span>}
          {m?.shard && <span className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">Shard {m.shard}</span>}
          {m?.os && <span className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">{m.os}</span>}
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-500 dark:bg-neutral-800">{new Date(run.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      </section>

      {/* 2 · What changed */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "New failures", n: newFailures.length, ids: newFailures.map((r) => r.id), tone: "text-red-600", note: "Passed last time" },
          { label: "Fixed", n: fixed.length, ids: rows.filter((r) => fixed.some((f) => f.key === r.key)).map((r) => r.id), tone: "text-emerald-600", note: "Failed last time" },
          { label: "Newly flaky", n: newlyFlaky.length, ids: newlyFlaky.map((r) => r.id), tone: "text-amber-600", note: "Needed a retry" },
          { label: "Got slower", n: slower.length, ids: slower.map((r) => r.id), tone: "text-violet-600", note: "1.5× its usual time" },
        ].map((c) => (
          <button key={c.label} type="button" disabled={!c.n} onClick={() => focus(c.ids, c.label)}
            className="rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400 disabled:cursor-default disabled:hover:border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[12px] text-neutral-500">{c.label}</p>
            <p className={`mt-0.5 text-2xl font-semibold tracking-tight ${c.n ? c.tone : "text-neutral-300 dark:text-neutral-700"}`}>{c.n}</p>
            <p className="text-[11.5px] text-neutral-500">{previous ? `${c.note} on this branch` : "No earlier run on this branch"}</p>
          </button>
        ))}
      </section>

      {/* 3 · Root causes */}
      {clusters.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-[14px] font-semibold">Same error, several tests</h3>
          <p className="text-[12.5px] text-neutral-500">Fix one root cause, clear many failures.</p>
          <ul className="mt-3 space-y-2">
            {clusters.map((c) => (
              <li key={c.signature}>
                <button type="button" onClick={() => focus(c.ids, `${c.ids.length} tests with the same error`)} className="flex w-full items-center gap-3 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-left hover:border-red-300 dark:border-red-900/50 dark:bg-red-950/20">
                  <span className="grid h-7 min-w-7 place-items-center rounded-full bg-red-600 px-2 text-[12px] font-semibold text-white">{c.ids.length}</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-red-900 dark:text-red-200">{c.sample}</code>
                  <span className="text-[12px] text-neutral-500">Show tests</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4 · Tests */}
      <section className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3 dark:border-neutral-800">
          {only ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1.5 text-[12.5px] text-white dark:bg-white dark:text-neutral-900">
              {onlyLabel} · {only.length}
              <button type="button" aria-label="Clear filter" onClick={() => { setOnly(null); setOpen(null); }} className="opacity-70 hover:opacity-100">✕</button>
            </span>
          ) : (
            <div role="tablist" aria-label="Filter tests" className="inline-flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
              {([["failed", `Failed ${counts.failed}`], ["flaky", `Flaky ${counts.flaky}`], ["passed", `Passed ${counts.passed}`], ["all", `All ${executed}`], ["slowest", "Slowest"]] as [Tab, string][]).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`rounded-md px-3 py-1.5 text-[12.5px] ${tab === k ? "bg-white font-medium shadow-sm dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400"}`}>{l}</button>
              ))}
            </div>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests, files or errors" aria-label="Search tests"
            className="ml-auto w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-1.5 text-[13px] sm:w-72 dark:border-neutral-700" />
        </div>

        {list.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-neutral-500">{tab === "failed" && !q ? "Nothing failed in this run." : "No tests match."}</p>
        ) : (
          <div>
            {grouped.map(([file, items]) => (
              <div key={file || "all"}>
                {file && (
                  <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/95 px-4 py-1.5 text-[12px] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
                    <span className="truncate font-mono text-neutral-600 dark:text-neutral-400">{file}</span>
                    <span className="ml-auto text-neutral-400">{items.length}</span>
                  </div>
                )}
                <ul>
                  {items.map((r) => (
                    <li key={r.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                      <button type="button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-950">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE[r.status]?.dot ?? "bg-neutral-300"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{r.name}</span>
                          {r.status === "failed" && r.error && <span className="block truncate text-[12px] text-red-700 dark:text-red-400">{r.error}</span>}
                        </span>
                        {r.change === "new-failure" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">New</span>}
                        {r.change === "slower" && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">Slower</span>}
                        {r.flakeRate != null && r.flakeRate > 0 && <span className="hidden text-[11.5px] text-amber-600 sm:inline">{Math.round(r.flakeRate * 100)}% flaky</span>}
                        <span className="hidden items-end gap-[2px] md:flex" aria-hidden="true">{r.history.slice(-10).map((h, i) => <i key={i} className={`h-3 w-1.5 rounded-[2px] ${TONE[h.status]?.dot ?? "bg-neutral-300"} ${h.current ? "" : "opacity-60"}`} />)}</span>
                        <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-neutral-500">{fmt(r.durationMs)}</span>
                        <span className={`w-16 shrink-0 text-right text-[11.5px] font-medium ${TONE[r.status]?.text}`}>{TONE[r.status]?.label}</span>
                      </button>
                      {open === r.id && <Detail row={r} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
