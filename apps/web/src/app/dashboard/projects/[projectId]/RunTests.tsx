"use client";

import { useRef, useState } from "react";

type Status = "pending" | "running" | "passed" | "failed" | "flaky" | "healed" | "healing";
interface Row {
  name: string; spec_path: string; status: Status; durationMs: number;
  error: string | null; explanation: string | null; healed: boolean; healExplanation: string | null;
  screenshot_url: string | null; plan: string[];
}
interface Summary { total: number; passed: number; healed: number; failed: number; flaky: number }
interface TestOpt { id: string; name: string; suite: string | null }

type Phase = "idle" | "executing" | "healing" | "done" | "error";

export function RunTests({ projectId, tests, kind }: { projectId: string; tests: TestOpt[]; kind?: "ui" | "api" }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [healCount, setHealCount] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rowsRef = useRef<Map<string, Row>>(new Map());

  function commit() { setRows([...rowsRef.current.values()]); }
  // Keyed by spec_path — stable across phases (the runner's title may differ from the name).
  function upsert(key: string, patch: Partial<Row>) {
    const cur = rowsRef.current.get(key) ?? { name: patch.name ?? key, spec_path: key, status: "pending" as Status, durationMs: 0, error: null, explanation: null, healed: false, healExplanation: null, screenshot_url: null, plan: [] };
    rowsRef.current.set(key, { ...cur, ...patch });
  }
  function toggleExpand(key: string) { setExpanded((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; }); }

  async function run() {
    setPhase("executing"); setError(""); setSummary(null); setHealCount(0);
    rowsRef.current = new Map(); commit();
    try {
      const res = await fetch(`/api/projects/${projectId}/run-tests`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ testIds: picked.size ? [...picked] : undefined, kind }),
      });
      if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Run failed (${res.status}).`);
      }
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line); } catch { continue; }
          handle(ev);
        }
      }
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handle(ev: Record<string, unknown>) {
    switch (ev.type) {
      case "queued": {
        for (const t of (ev.tests as { name: string; spec_path: string }[]) ?? []) {
          upsert(t.spec_path, { name: t.name, spec_path: t.spec_path, status: "running" });
        }
        commit();
        break;
      }
      case "result": {
        upsert(ev.spec_path as string, {
          name: ev.name as string, spec_path: ev.spec_path as string, status: ev.status as Status,
          durationMs: (ev.durationMs as number) ?? 0, error: (ev.error as string) ?? null,
          explanation: (ev.explanation as string) ?? null, screenshot_url: (ev.screenshot_url as string) ?? null,
          plan: (ev.plan as string[]) ?? [],
        });
        commit();
        break;
      }
      case "phase":
        if (ev.phase === "healing") { setPhase("healing"); setHealCount((ev.count as number) ?? 0); }
        break;
      case "healing":
        upsert(ev.spec_path as string, { status: "healing" });
        commit();
        break;
      case "healed": {
        upsert(ev.spec_path as string, {
          status: ev.status as Status, healed: !!ev.healed,
          healExplanation: (ev.healExplanation as string) ?? null,
          explanation: (ev.explanation as string) ?? null, error: (ev.error as string) ?? null,
          durationMs: (ev.durationMs as number) ?? 0, screenshot_url: (ev.screenshot_url as string) ?? null,
        });
        commit();
        break;
      }
      case "done":
        setSummary(ev.summary as Summary);
        rowsRef.current = new Map((ev.report as Row[]).map((r) => [r.spec_path, { ...r, status: r.status }]));
        commit();
        setPhase("done");
        break;
      case "error":
        setPhase("error");
        setError(ev.error as string);
        break;
    }
  }

  function downloadReport() {
    if (!rows.length || !summary) return;
    const cell = (r: Row) => {
      const parts: string[] = [];
      if (r.healed && r.healExplanation) parts.push(`<div style="color:#7c3aed"><b>Self-healed:</b> ${esc(r.healExplanation)}</div>`);
      if (r.explanation) parts.push(`<div><b>Why:</b> ${esc(r.explanation)}</div>`);
      if (r.error) parts.push(`<pre>${esc(r.error)}</pre>`);
      if (r.screenshot_url) parts.push(`<a href="${r.screenshot_url}">screenshot</a>`);
      return parts.join("<br>");
    };
    const rowsHtml = rows.map((r) => `
      <tr class="${r.status}">
        <td>${esc(r.name)}</td><td><code>${esc(r.spec_path)}</code></td>
        <td class="s">${r.status}</td><td>${r.durationMs} ms</td>
        <td>${cell(r)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Verity run report</title>
      <style>body{font-family:system-ui;margin:40px;max-width:1000px}h1{font-size:20px}
      table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
      .passed .s,.healed .s{color:#059669}.failed .s{color:#dc2626}.flaky .s{color:#d97706}pre{white-space:pre-wrap;margin:0;font-size:12px;color:#dc2626}
      .sum span{display:inline-block;margin-right:16px}</style></head><body>
      <h1>Verity — cloud run report</h1>
      <p class="sum"><span><b>${summary.total}</b> total</span><span style="color:#059669"><b>${summary.passed}</b> passed</span><span style="color:#7c3aed"><b>${summary.healed}</b> self-healed</span><span style="color:#dc2626"><b>${summary.failed}</b> failed</span><span style="color:#d97706"><b>${summary.flaky}</b> flaky</span><span>${new Date().toLocaleString()}</span></p>
      <table><thead><tr><th>Test</th><th>Spec</th><th>Status</th><th>Duration</th><th>Details</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "verity-report.html"; a.click(); URL.revokeObjectURL(url);
  }

  function toggle(id: string) { setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  const busy = phase === "executing" || phase === "healing";
  const dot = (s: Status) =>
    s === "passed" || s === "healed" ? "bg-emerald-500"
    : s === "failed" ? "bg-red-500"
    : s === "flaky" ? "bg-amber-500"
    : s === "healing" ? "bg-violet-500 animate-pulse"
    : "bg-indigo-500 animate-pulse";
  const label = (s: Status) =>
    s === "healed" ? "passed · self-healed ✓" : s === "passed" ? "passed ✓" : s === "failed" ? "failed" : s === "flaky" ? "flaky" : s === "healing" ? "self-healing…" : "running…";

  return (
    <div className="border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Run tests in the cloud</h3>
        <span className="border border-indigo-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-600 dark:border-indigo-800 dark:text-indigo-400">real execution · original assertions</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">Executes your saved Playwright specs with their original assertions in a cloud browser. Failures stay visible for review; verification does not rewrite tests to make them pass. Capped per plan; CI is unlimited.</p>

      {tests.length > 0 && (() => {
        const groups = new Map<string, TestOpt[]>();
        for (const t of tests) { const k = t.suite || "Ungrouped"; (groups.get(k) ?? groups.set(k, []).get(k)!).push(t); }
        const toggleGroup = (gr: TestOpt[]) => setPicked((p) => { const n = new Set(p); const all = gr.every((t) => n.has(t.id)); gr.forEach((t) => (all ? n.delete(t.id) : n.add(t.id))); return n; });
        return (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-neutral-500">Choose tests or sets ({picked.size ? `${picked.size} selected` : "all"})</summary>
            <div className="mt-2 space-y-3">
              {[...groups.entries()].map(([suite, gr]) => (
                <div key={suite}>
                  <label className="flex items-center gap-2 font-semibold text-neutral-600 dark:text-neutral-300">
                    <input type="checkbox" checked={gr.every((t) => picked.has(t.id))} onChange={() => toggleGroup(gr)} />
                    {suite} <span className="text-neutral-400">({gr.length})</span>
                  </label>
                  <div className="mt-1 grid gap-1 pl-5 sm:grid-cols-2">
                    {gr.map((t) => (
                      <label key={t.id} className="flex items-center gap-2"><input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />{t.name}</label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })()}

      <button onClick={run} disabled={busy} className="mt-3 bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Running…" : `▶ Run ${picked.size ? picked.size : "all"} test${(picked.size || tests.length) === 1 ? "" : "s"}`}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Live status banner */}
      {phase !== "idle" && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${phase === "executing" ? "bg-indigo-500 animate-pulse" : phase === "healing" ? "bg-violet-500 animate-pulse" : phase === "done" ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="font-medium">
            {phase === "executing" && `Executing ${rows.length} test${rows.length === 1 ? "" : "s"} in a real browser…`}
            {phase === "healing" && `Self-healing ${healCount} failure${healCount === 1 ? "" : "s"} — re-reading the page and rewriting locators…`}
            {phase === "done" && "Run complete"}
            {phase === "error" && "Run failed"}
          </span>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-neutral-500">{summary.total} total</span>
            <span className="text-emerald-600">{summary.passed + summary.healed} passed{summary.healed > 0 && <span className="text-violet-600"> (incl. {summary.healed} self-healed)</span>}</span>
            <span className="text-red-600">{summary.failed} failed</span>
            <span className="text-amber-600">{summary.flaky} flaky</span>
          </div>
          <button onClick={downloadReport} className="border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700">⤓ Download report</button>
        </div>
      )}

      {/* Live rows */}
      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((r) => {
            const open = expanded.has(r.spec_path);
            const hasSteps = r.plan && r.plan.length > 0;
            return (
            <div key={r.spec_path} className="border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => hasSteps && toggleExpand(r.spec_path)}
                className={`flex w-full items-center gap-2 p-3 text-left ${hasSteps ? "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/40" : "cursor-default"}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${dot(r.status)}`} />
                <span className="text-sm font-medium">{r.name}</span>
                <span className={`ml-auto text-[11px] font-semibold ${r.status === "passed" || r.status === "healed" ? "text-emerald-600" : r.status === "failed" ? "text-red-600" : r.status === "flaky" ? "text-amber-600" : r.status === "healing" ? "text-violet-600" : "text-neutral-400"}`}>{label(r.status)}</span>
                {r.durationMs > 0 && <span className="text-[11px] text-neutral-400">{r.durationMs} ms</span>}
                {hasSteps && <span className="text-[11px] text-neutral-400">{open ? "▾" : "▸"}</span>}
              </button>
              <div className="px-3 pb-3">
                {r.healed && r.healExplanation && (
                  <p className="border-l-2 border-violet-500 pl-2 text-xs text-violet-700 dark:text-violet-300"><strong>Self-healed:</strong> {r.healExplanation}</p>
                )}
                {r.status === "failed" && r.explanation && (
                  <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-300"><strong className="text-red-600">Why it failed:</strong> {r.explanation}</p>
                )}
                {r.status === "failed" && r.screenshot_url && (
                  <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-indigo-600 underline">screenshot at failure</a>
                )}
                {open && hasSteps && (
                  <div className="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Steps {r.status === "failed" ? "(intended)" : "verified"}</p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-neutral-600 dark:text-neutral-300">
                      {r.plan.map((s, j) => <li key={j}>{s}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
