"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Opt = { value: string; label: string };

const RESULT: Opt[] = [
  { value: "", label: "All" }, { value: "failed", label: "Failed" }, { value: "flaky", label: "Flaky" },
  { value: "passed", label: "Passed" }, { value: "running", label: "In progress" },
];
const SOURCE: Opt[] = [{ value: "", label: "Any source" }, { value: "ci", label: "CI" }, { value: "cloud", label: "Cloud run" }, { value: "local", label: "Local" }];
const AGENT: Opt[] = [
  { value: "", label: "Any agent" }, { value: "ui", label: "Scout · UI" }, { value: "api", label: "Relay · API" },
  { value: "performance", label: "Pulse · Performance" }, { value: "security", label: "Warden · Security" },
  { value: "accessibility", label: "Lumen · Accessibility" }, { value: "visual", label: "Prism · Visual" },
];
const RANGE: Opt[] = [{ value: "", label: "Any time" }, { value: "1", label: "Last 24 hours" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }];

const select = "h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] text-neutral-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-violet-900";

/** Filters live in the URL (shareable, survive refresh); the server applies them. */
export function RunFilters({ projects, total, showProject = true }: { projects?: Opt[]; total: number; showProject?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  // Debounced branch / PR search.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => set("q", q.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["result", "source", "agent", "range", "project", "q"].filter((k) => params.get(k)).length;
  const result = params.get("result") ?? "";

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 p-3 dark:border-neutral-800" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Filter by result" className="inline-flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
          {RESULT.map((o) => (
            <button key={o.value} type="button" role="tab" aria-selected={result === o.value} onClick={() => set("result", o.value)}
              className={`h-8 rounded-md px-3 text-[13px] font-medium transition ${result === o.value ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"}`}>
              {o.label}
            </button>
          ))}
        </div>
        <span className="ml-auto inline-flex items-center gap-2 text-[12.5px] text-neutral-500">
          {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden="true" />}
          {pending ? "Updating…" : `${total} run${total === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Branch, PR number or commit" aria-label="Search by branch, PR or commit"
          className={`${select} w-full sm:w-64`} />
        {showProject && projects && projects.length > 1 && (
          <select aria-label="Project" className={select} value={params.get("project") ?? ""} onChange={(e) => set("project", e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        )}
        <select aria-label="Source" className={select} value={params.get("source") ?? ""} onChange={(e) => set("source", e.target.value)}>
          {SOURCE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select aria-label="Agent" className={select} value={params.get("agent") ?? ""} onChange={(e) => set("agent", e.target.value)}>
          {AGENT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select aria-label="Time range" className={select} value={params.get("range") ?? ""} onChange={(e) => set("range", e.target.value)}>
          {RANGE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {active > 0 && (
          <button type="button" onClick={() => { setQ(""); start(() => router.replace(pathname, { scroll: false })); }}
            className="h-9 rounded-lg px-3 text-[13px] font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
