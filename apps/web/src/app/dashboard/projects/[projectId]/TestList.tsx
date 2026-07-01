"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

export interface TestRow {
  id: string;
  name: string;
  spec_path: string;
  suite: string | null;
  status: string;
  critical_path: boolean;
  is_pom: boolean;
  confidenceLabel: string;
  flakeLabel: string;
  plan: string[];
  spec_content: string;
}

function PushButton({ projectId, testId, repoLinked }: { projectId: string; testId: string; repoLinked: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  async function push() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tests/${testId}/push`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Push failed.");
      setMsg({ ok: true, text: "Opened a PR →", url: data.pr_url });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Push failed." }); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={push} disabled={busy || !repoLinked} title={repoLinked ? "" : "Link a GitHub repo first"}
        className="bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900">
        {busy ? "Pushing…" : "⤴ Push just this test"}
      </button>
      {msg && (msg.url ? <a href={msg.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 underline">{msg.text}</a> : <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>)}
    </div>
  );
}

export function TestList({ projectId, rows, repoLinked }: { projectId: string; rows: TestRow[]; repoLinked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"plan" | "code">("plan");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (rows.length === 0) return <p className="mt-3 text-sm text-neutral-500">No tests yet. Generate one above.</p>;

  const groups = new Map<string, TestRow[]>();
  for (const t of rows) { const k = t.suite || "Ungrouped"; (groups.get(k) ?? groups.set(k, []).get(k)!).push(t); }
  const ordered = [...groups.entries()].sort((a, b) => (a[0] === "Ungrouped" ? 1 : b[0] === "Ungrouped" ? -1 : 0));

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGroup = (gr: TestRow[]) => setSel((p) => {
    const n = new Set(p); const all = gr.every((t) => n.has(t.id));
    gr.forEach((t) => (all ? n.delete(t.id) : n.add(t.id))); return n;
  });

  async function bulk(action: string, suite?: string | null) {
    if (sel.size === 0) return;
    if (action === "delete" && !confirm(`Delete ${sel.size} test(s)? This can't be undone.`)) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/tests/bulk`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [...sel], action, suite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      setSel(new Set());
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Action failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3">
      {/* Bulk toolbar */}
      <div className={`mb-2 flex flex-wrap items-center gap-2 border p-2 text-xs transition ${sel.size ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20" : "border-transparent"}`}>
        {sel.size === 0 ? (
          <span className="text-neutral-400">Select tests for bulk actions (activate, move to a set, delete…)</span>
        ) : (
          <>
            <span className="font-medium">{sel.size} selected</span>
            <button onClick={() => bulk("activate")} disabled={busy} className="border border-neutral-300 px-2 py-1 hover:bg-white dark:border-neutral-700">Activate</button>
            <button onClick={() => bulk("draft")} disabled={busy} className="border border-neutral-300 px-2 py-1 hover:bg-white dark:border-neutral-700">Set draft</button>
            <button onClick={() => bulk("archive")} disabled={busy} className="border border-neutral-300 px-2 py-1 hover:bg-white dark:border-neutral-700">Archive</button>
            <button onClick={() => { const s = prompt("Move to set (name, blank = ungroup):", ""); if (s !== null) bulk("move", s.trim() || null); }} disabled={busy} className="border border-neutral-300 px-2 py-1 hover:bg-white dark:border-neutral-700">Move to set…</button>
            <button onClick={() => bulk("delete")} disabled={busy} className="border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50 dark:border-red-800">Delete</button>
            <button onClick={() => setSel(new Set())} className="text-neutral-400 hover:text-neutral-600">clear</button>
          </>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-xs text-neutral-400 dark:border-neutral-800">
            <tr><th className="w-8 p-3"></th><th className="p-3">Name</th><th className="p-3">Confidence</th><th className="p-3">Flake</th><th className="p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {ordered.map(([suite, gr]) => (
              <Fragment key={suite}>
                <tr className="bg-neutral-50 dark:bg-neutral-900/60">
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={gr.every((t) => sel.has(t.id))} onChange={() => toggleGroup(gr)} title="Select whole set" />
                  </td>
                  <td colSpan={5} className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{suite} <span className="text-neutral-400">({gr.length})</span></td>
                </tr>
                {gr.map((t) => (
                  <Fragment key={t.id}>
                    <tr className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                      <td className="p-3 text-center"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} /></td>
                      <td className="p-3">
                        <button onClick={() => { setOpen(open === t.id ? null : t.id); setTab("plan"); }} className="text-left font-medium hover:text-indigo-600">{open === t.id ? "▾ " : "▸ "}{t.name}</button>
                        <div className="flex gap-1 pt-0.5">
                          {t.critical_path && <span className="border border-indigo-300 px-1 text-[10px] text-indigo-600 dark:border-indigo-800 dark:text-indigo-300">critical</span>}
                          {t.is_pom && <span className="border border-emerald-300 px-1 text-[10px] text-emerald-600 dark:border-emerald-800 dark:text-emerald-300">POM</span>}
                          <span className="font-mono text-[10px] text-neutral-400">{t.spec_path}</span>
                        </div>
                      </td>
                      <td className="p-3">{t.confidenceLabel}</td>
                      <td className="p-3">{t.flakeLabel}</td>
                      <td className="p-3 text-xs">{t.status}</td>
                      <td className="p-3 text-right"><button onClick={() => { setOpen(open === t.id ? null : t.id); setTab("plan"); }} className="text-xs text-indigo-600 hover:underline">{open === t.id ? "hide" : "view"}</button></td>
                    </tr>
                    {open === t.id && (
                      <tr className="border-b border-neutral-100 dark:border-neutral-800/60">
                        <td colSpan={6} className="p-3">
                          <div className="border border-neutral-200 dark:border-neutral-800">
                            <div className="flex border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                              {(["plan", "code"] as const).map((tb) => (
                                <button key={tb} onClick={() => setTab(tb)} className={`px-4 py-2 text-xs font-medium ${tab === tb ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400" : "text-neutral-500"}`}>{tb === "plan" ? "Plan (English)" : "Playwright code"}</button>
                              ))}
                            </div>
                            {tab === "plan" ? (
                              <ol className="list-decimal space-y-1.5 p-4 pl-8 text-sm">{t.plan.length ? t.plan.map((s, i) => <li key={i} className="text-neutral-700 dark:text-neutral-300">{s}</li>) : <li className="text-neutral-500">No plan stored.</li>}</ol>
                            ) : (
                              <pre className="max-h-80 overflow-auto bg-neutral-950 p-4 text-xs text-neutral-200"><code>{t.spec_content}</code></pre>
                            )}
                          </div>
                          <div className="mt-3"><PushButton projectId={projectId} testId={t.id} repoLinked={repoLinked} /></div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
