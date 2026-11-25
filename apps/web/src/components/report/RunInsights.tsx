"use client";

import { useMemo } from "react";
import type { ReportRow, Status } from "@/lib/reports/run-report";

const fmt = (ms: number) => (ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

/** Plain-English failure categories, derived from the Playwright error text. */
export const CATEGORIES = [
  { key: "network", label: "Network / server", hint: "The app or an API couldn't be reached or returned an error.", re: /net::ERR|ECONNREFUSED|ECONNRESET|ENOTFOUND|ERR_CONNECTION|socket hang up|status(?: code)? 5\d\d|\b50[0-4]\b/i },
  { key: "locator", label: "Element not found or ambiguous", hint: "A selector matched nothing, or more than one element.", re: /strict mode violation|resolved to \d+ elements|waiting for (?:locator|getBy)|element\(s\) not found|not attached|is not visible|no element matches/i },
  { key: "timeout", label: "Timed out", hint: "Something took longer than the test allows.", re: /timeout|timed out|exceeded/i },
  { key: "assertion", label: "Assertion", hint: "The page loaded, but showed something different from what the test expects.", re: /expect\(|toHave|toBe|toEqual|toContain|toMatch|Expected/i },
  { key: "crash", label: "Script or page error", hint: "The test code or the page threw an exception.", re: /TypeError|ReferenceError|SyntaxError|Cannot read|is not a function|page crashed|Target closed/i },
] as const;
export function categorize(err: string | null): string {
  if (!err) return "other";
  return CATEGORIES.find((c) => c.re.test(err))?.key ?? "other";
}

const PASSISH: Status[] = ["passed", "healed", "flaky"];

export function RunInsights({ rows, onFocus }: { rows: ReportRow[]; onFocus: (ids: string[], label: string) => void }) {
  const failures = rows.filter((r) => r.status === "failed");

  const cats = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of failures) { const k = categorize(r.error); m.set(k, [...(m.get(k) ?? []), r.id]); }
    return [...CATEGORIES.map((c) => ({ key: c.key, label: c.label, hint: c.hint })), { key: "other", label: "Other", hint: "See the error on each test." }]
      .map((c) => ({ ...c, ids: m.get(c.key) ?? [] })).filter((c) => c.ids.length).sort((a, b) => b.ids.length - a.ids.length);
  }, [failures]);

  const files = useMemo(() => {
    const m = new Map<string, { ids: string[]; failed: number; flaky: number; passed: number; ms: number }>();
    for (const r of rows) {
      const f = m.get(r.file) ?? { ids: [], failed: 0, flaky: 0, passed: 0, ms: 0 };
      f.ids.push(r.id); f.ms += r.durationMs;
      if (r.status === "failed") f.failed++; else if (r.status === "flaky") f.flaky++; else if (r.status === "passed" || r.status === "healed") f.passed++;
      m.set(r.file, f);
    }
    return [...m.entries()].map(([file, v]) => ({ file, ...v, total: v.ids.length }))
      .sort((a, b) => b.failed - a.failed || b.flaky - a.flaky || b.ms - a.ms);
  }, [rows]);
  const maxMs = Math.max(1, ...files.map((f) => f.ms));

  // Branch trend: rebuild each earlier run's pass rate from the per-test history.
  const trend = useMemo(() => {
    const runs = new Map<string, { at: string; total: number; ok: number; current: boolean }>();
    for (const r of rows) for (const h of r.history) {
      const x = runs.get(h.runId) ?? { at: h.at, total: 0, ok: 0, current: h.current };
      if (h.status !== "skipped") { x.total++; if (PASSISH.includes(h.status)) x.ok++; }
      runs.set(h.runId, x);
    }
    return [...runs.values()].filter((x) => x.total).sort((a, b) => a.at.localeCompare(b.at)).slice(-20);
  }, [rows]);

  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Test", "File", "Status", "Duration ms", "Attempts", "Category", "Flake rate", "Failing for runs", "Error"];
    const body = rows.map((r) => [r.name, r.file, r.status, Math.round(r.durationMs), r.attempts, r.status === "failed" ? categorize(r.error) : "", r.flakeRate == null ? "" : `${Math.round(r.flakeRate * 100)}%`, r.failingSince?.runs ?? "", r.error ?? ""].map(esc).join(","));
    const blob = new Blob([[head.map(esc).join(","), ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "qashift-run.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  const card = "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="grid gap-4">
        <div className={card}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold">Why tests failed</h3>
            <button type="button" onClick={csv} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[12px] font-medium hover:bg-neutral-50 active:scale-[.98] dark:border-neutral-700 dark:hover:bg-neutral-800">Download CSV</button>
          </div>
          {cats.length === 0 ? <p className="mt-2 text-[13px] text-neutral-500">Nothing failed in this run.</p> : (
            <ul className="mt-3 space-y-2">
              {cats.map((c) => (
                <li key={c.key}>
                  <button type="button" onClick={() => onFocus(c.ids, c.label)} className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-neutral-50 active:scale-[.99] dark:hover:bg-neutral-800">
                    <div className="flex items-center gap-2 text-[13px]"><b className="font-medium">{c.label}</b><span className="ml-auto tabular-nums text-neutral-500">{c.ids.length}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-red-500" style={{ width: `${(c.ids.length / failures.length) * 100}%` }} /></div>
                    <p className="mt-1 text-[11.5px] text-neutral-500">{c.hint}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {trend.length > 1 && (
          <div className={card}>
            <h3 className="text-[14px] font-semibold">Pass rate on this branch</h3>
            <p className="text-[12px] text-neutral-500">Last {trend.length} runs, oldest first. This run is outlined.</p>
            <div className="mt-3 flex h-20 items-end gap-1" role="img" aria-label={`Pass rate over the last ${trend.length} runs`}>
              {trend.map((t, i) => {
                const pct = t.ok / t.total;
                return (
                  <div key={i} title={`${Math.round(pct * 100)}% · ${new Date(t.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
                    className={`flex-1 rounded-sm ${pct === 1 ? "bg-emerald-500" : pct >= 0.8 ? "bg-amber-400" : "bg-red-500"} ${t.current ? "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white dark:ring-offset-neutral-900" : "opacity-80"}`}
                    style={{ height: `${Math.max(6, pct * 100)}%` }} />
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className={card}>
        <h3 className="text-[14px] font-semibold">Spec files</h3>
        <p className="text-[12px] text-neutral-500">Worst first. Bar length is time spent; click a file to see its tests.</p>
        <ul className="mt-3 max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {files.map((f) => (
            <li key={f.file}>
              <button type="button" onClick={() => onFocus(f.ids, f.file)} className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-neutral-50 active:scale-[.99] dark:hover:bg-neutral-800">
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate font-mono">{f.file}</span>
                  {f.failed > 0 && <span className="text-red-600">{f.failed} failed</span>}
                  {f.flaky > 0 && <span className="text-amber-600">{f.flaky} flaky</span>}
                  <span className="tabular-nums text-neutral-500">{f.passed}/{f.total}</span>
                  <span className="w-14 text-right tabular-nums text-neutral-500">{fmt(f.ms)}</span>
                </div>
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" style={{ width: `${Math.max(8, (f.ms / maxMs) * 100)}%` }}>
                  <i className="bg-emerald-500" style={{ width: `${(f.passed / f.total) * 100}%` }} />
                  <i className="bg-amber-400" style={{ width: `${(f.flaky / f.total) * 100}%` }} />
                  <i className="bg-red-500" style={{ width: `${(f.failed / f.total) * 100}%` }} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
