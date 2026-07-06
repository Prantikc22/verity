"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** One row in the project-wide test library — any discipline. */
export interface ManagedTest {
  id: string;
  name: string;
  spec_path: string;
  suite: string | null;
  status: string;
  kind: string;
  /** Verified ✓ is only honest where the verify pipeline runs (UI/visual/agent). */
  verifiable: boolean;
  critical_path: boolean;
  is_pom: boolean;
  /** Numeric confidence 0..1 for sorting; null = not enough runs. */
  confidence: number | null;
  confidenceLabel: string;
  /** Numeric flake rate 0..1 for sorting; null = no runs. */
  flakePct: number | null;
  flakeLabel: string;
  /** Epoch ms for recency sorting. */
  createdMs: number;
  plan: string[];
  spec_content: string;
}

const KIND_META: Record<string, { label: string; badge: string; dot: string }> = {
  ui: { label: "UI", badge: "border-indigo-300 text-indigo-600 dark:border-indigo-800 dark:text-indigo-300", dot: "bg-indigo-500" },
  api: { label: "API", badge: "border-sky-300 text-sky-600 dark:border-sky-800 dark:text-sky-300", dot: "bg-sky-500" },
  visual: { label: "Visual", badge: "border-violet-300 text-violet-600 dark:border-violet-800 dark:text-violet-300", dot: "bg-violet-500" },
  agent: { label: "Agent", badge: "border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500" },
};
const kindMeta = (k: string) => KIND_META[k] ?? { label: k, badge: "border-neutral-300 text-neutral-500 dark:border-neutral-700", dot: "bg-neutral-400" };

type SortKey = "recent" | "name" | "confidence" | "flake" | "status";
type GroupKey = "kind" | "suite" | "none";

function StatusCell({ status, verifiable }: { status: string; verifiable: boolean }) {
  if (status === "active") return <span className="text-emerald-600 dark:text-emerald-400">{verifiable ? "Verified ✓" : "Active"}</span>;
  if (status === "quarantined") return <span className="text-amber-600 dark:text-amber-400" title="Failed in a real browser after healing — review the code/plan">Needs review</span>;
  if (status === "draft") return <span className="text-neutral-400" title={verifiable ? "Generated but not yet run in a browser" : "Generated — review, then Activate"}>{verifiable ? "Unverified" : "Draft"}</span>;
  if (status === "archived") return <span className="text-neutral-400">Archived</span>;
  return <span className="text-neutral-500">{status}</span>;
}

/** Compact per-group status summary, Linear-style. */
function groupSummary(rows: ManagedTest[]): string {
  const verified = rows.filter((t) => t.status === "active" && t.verifiable).length;
  const active = rows.filter((t) => t.status === "active" && !t.verifiable).length;
  const draft = rows.filter((t) => t.status === "draft").length;
  const review = rows.filter((t) => t.status === "quarantined").length;
  const parts: string[] = [];
  if (verified) parts.push(`${verified} verified`);
  if (active) parts.push(`${active} active`);
  if (draft) parts.push(`${draft} draft`);
  if (review) parts.push(`${review} to review`);
  return parts.join(" · ") || `${rows.length} test${rows.length === 1 ? "" : "s"}`;
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

export function TestManager({ projectId, rows, repoLinked }: { projectId: string; rows: ManagedTest[]; repoLinked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"plan" | "code">("plan");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Filters / view state
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [group, setGroup] = useState<GroupKey>("kind");
  // Which groups the user has expanded. Empty = all collapsed (tidy overview).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const kindsPresent = useMemo(() => [...new Set(rows.map((r) => r.kind))], [rows]);
  const filtersActive = Boolean(q.trim()) || kind !== "all" || status !== "all" || criticalOnly;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (status !== "all" && r.status !== status) return false;
      if (criticalOnly && !r.critical_path) return false;
      if (needle) {
        const hay = `${r.name} ${r.spec_path} ${r.suite ?? ""} ${kindMeta(r.kind).label}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const cmp: Record<SortKey, (a: ManagedTest, b: ManagedTest) => number> = {
      recent: (a, b) => b.createdMs - a.createdMs,
      name: (a, b) => a.name.localeCompare(b.name),
      confidence: (a, b) => (b.confidence ?? -1) - (a.confidence ?? -1),
      flake: (a, b) => (b.flakePct ?? -1) - (a.flakePct ?? -1),
      status: (a, b) => a.status.localeCompare(b.status),
    };
    return [...out].sort(cmp[sort]);
  }, [rows, q, kind, status, criticalOnly, sort]);

  const grouped = useMemo(() => {
    if (group === "none") return [["", filtered]] as [string, ManagedTest[]][];
    const map = new Map<string, ManagedTest[]>();
    for (const t of filtered) {
      const key = group === "kind" ? kindMeta(t.kind).label : (t.suite || "Ungrouped");
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    const entries = [...map.entries()];
    if (group === "suite") entries.sort((a, b) => (a[0] === "Ungrouped" ? 1 : b[0] === "Ungrouped" ? -1 : 0));
    return entries;
  }, [filtered, group]);

  // A group renders open when the user expanded it, OR filters are active (so
  // matches are never hidden), OR there's only one group to show.
  const isGroupOpen = (label: string) => group === "none" || filtersActive || expanded.has(label) || grouped.length === 1;
  const toggleExpand = (label: string) => setExpanded((p) => { const n = new Set(p); n.has(label) ? n.delete(label) : n.add(label); return n; });
  const allOpen = grouped.every(([l]) => isGroupOpen(l));
  const setAll = (openAll: boolean) => setExpanded(openAll ? new Set(grouped.map(([l]) => l)) : new Set());

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

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

  const selectClass = "border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200";

  return (
    <div>
      {/* Filter / search / view toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tests, paths, sets…"
            className="w-full border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-indigo-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass} title="Discipline">
          <option value="all">All disciplines</option>
          {kindsPresent.map((k) => <option key={k} value={k}>{kindMeta(k).label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} title="Status">
          <option value="all">Any status</option>
          <option value="active">Verified / Active</option>
          <option value="draft">Draft / Unverified</option>
          <option value="quarantined">Needs review</option>
          <option value="archived">Archived</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass} title="Sort by">
          <option value="recent">Newest</option>
          <option value="name">Name A–Z</option>
          <option value="confidence">Confidence</option>
          <option value="flake">Flakiest</option>
          <option value="status">Status</option>
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value as GroupKey)} className={selectClass} title="Group by">
          <option value="kind">Group: discipline</option>
          <option value="suite">Group: set</option>
          <option value="none">No grouping</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 border border-neutral-300 px-2 py-1.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
          Critical only
        </label>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
        <span>Showing {filtered.length} of {rows.length} test{rows.length === 1 ? "" : "s"}{group !== "none" && ` across ${grouped.length} group${grouped.length === 1 ? "" : "s"}`}</span>
        <div className="flex items-center gap-3">
          {group !== "none" && !filtersActive && grouped.length > 1 && (
            <button onClick={() => setAll(!allOpen)} className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">{allOpen ? "Collapse all" : "Expand all"}</button>
          )}
          {filtersActive && (
            <button onClick={() => { setQ(""); setKind("all"); setStatus("all"); setCriticalOnly(false); }} className="text-indigo-600 hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* Bulk toolbar */}
      <div className={`mt-2 mb-2 flex flex-wrap items-center gap-2 border p-2 text-xs transition ${sel.size ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20" : "border-transparent"}`}>
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

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No tests match these filters.</p>
      ) : (
        <div className="divide-y divide-neutral-200 border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {grouped.map(([label, gr]) => {
            const openGroup = isGroupOpen(label);
            const groupColor = group === "kind" ? kindMeta(gr[0]?.kind ?? "").dot : "bg-neutral-400";
            return (
              <div key={label || "flat"}>
                {/* Group header — click to drill in (Linear/Jira style) */}
                {label && (
                  <button
                    onClick={() => toggleExpand(label)}
                    disabled={filtersActive || grouped.length === 1}
                    className="flex w-full items-center gap-3 bg-neutral-50 px-3 py-2.5 text-left transition hover:bg-neutral-100 disabled:cursor-default disabled:hover:bg-neutral-50 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 dark:disabled:hover:bg-neutral-900/60"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 text-neutral-400 transition-transform ${openGroup ? "" : "-rotate-90"}`}><path d="M6 9l6 6 6-6" /></svg>
                    <span className={`h-2 w-2 shrink-0 ${groupColor}`} />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{gr.length}</span>
                    <span className="ml-auto truncate text-xs text-neutral-400">{groupSummary(gr)}</span>
                  </button>
                )}

                {/* Rows */}
                {openGroup && (
                  <table className="w-full text-sm">
                    <tbody>
                      {gr.map((t) => (
                        <Fragment key={t.id}>
                          <tr className="border-t border-neutral-100 hover:bg-neutral-50/60 dark:border-neutral-800/60 dark:hover:bg-neutral-900/30">
                            <td className="w-8 py-2.5 pl-3 text-center align-top"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} className="mt-1" /></td>
                            <td className="py-2.5 pr-3">
                              <button onClick={() => { setOpen(open === t.id ? null : t.id); setTab("plan"); }} className="text-left font-medium hover:text-indigo-600">{open === t.id ? "▾ " : "▸ "}{t.name}</button>
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                {group !== "kind" && <span className={`border px-1 text-[10px] font-medium ${kindMeta(t.kind).badge}`}>{kindMeta(t.kind).label}</span>}
                                {t.critical_path && <span className="border border-indigo-300 px-1 text-[10px] text-indigo-600 dark:border-indigo-800 dark:text-indigo-300">critical</span>}
                                {t.is_pom && <span className="border border-emerald-300 px-1 text-[10px] text-emerald-600 dark:border-emerald-800 dark:text-emerald-300">POM</span>}
                                <span className="font-mono text-[10px] text-neutral-400">{t.spec_path}</span>
                              </div>
                            </td>
                            <td className="hidden py-2.5 pr-3 text-xs text-neutral-500 sm:table-cell">{t.confidenceLabel}</td>
                            <td className="hidden py-2.5 pr-3 text-xs text-neutral-500 md:table-cell">{t.flakeLabel}</td>
                            <td className="py-2.5 pr-3 text-xs"><StatusCell status={t.status} verifiable={t.verifiable} /></td>
                            <td className="py-2.5 pr-3 text-right"><button onClick={() => { setOpen(open === t.id ? null : t.id); setTab("plan"); }} className="text-xs text-indigo-600 hover:underline">{open === t.id ? "hide" : "view"}</button></td>
                          </tr>
                          {open === t.id && (
                            <tr className="border-t border-neutral-100 dark:border-neutral-800/60">
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
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
