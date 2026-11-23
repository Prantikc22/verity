"use client";

import { useState } from "react";

/** Creates a 7-day, read-only link to this Reports view. */
export function ShareReport({ project, days }: { project: string | null; days: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const create = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/reports/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, days }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUrl(data.url); setState("done");
      try { await navigator.clipboard.writeText(data.url); setCopied(true); } catch { /* blocked */ }
    } catch { setState("error"); }
  };
  if (state === "done") {
    return (
      <div className="flex items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="w-64 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-[12px] dark:border-neutral-800 dark:bg-neutral-900" />
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }} className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12.5px] font-medium text-white dark:bg-white dark:text-neutral-900">{copied ? "Copied" : "Copy"}</button>
        <span className="text-[11.5px] text-neutral-500">Read-only · expires in 7 days</span>
      </div>
    );
  }
  return (
    <button type="button" onClick={create} disabled={state === "busy"} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900">
      {state === "busy" ? "Creating link…" : state === "error" ? "Try again" : "Share report"}
    </button>
  );
}
