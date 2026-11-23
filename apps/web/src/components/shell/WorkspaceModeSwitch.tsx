"use client";

import { useState } from "react";

const OPTIONS = [
  { mode: "full" as const, title: "Full workspace", body: "AI agents, test library, coverage and Reports." },
  { mode: "reports" as const, title: "Reports only", body: "Just run history, flaky and failing tests, and setup. Hides the agents." },
];

/** Same login and data either way; this only changes the navigation. */
export function WorkspaceModeSwitch({ initial, canEdit }: { initial: "full" | "reports"; canEdit: boolean }) {
  const [mode, setMode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (m: "full" | "reports") => {
    if (m === mode || !canEdit) return;
    setBusy(true); setErr(null);
    const res = await fetch("/api/workspace/mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: m }) });
    if (res.ok) { setMode(m); window.location.reload(); return; }
    setErr((await res.json().catch(() => ({}))).error ?? "Couldn't switch. Try again.");
    setBusy(false);
  };
  return (
    <div>
      <div role="radiogroup" aria-label="Workspace" className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button key={o.mode} type="button" role="radio" aria-checked={mode === o.mode} disabled={busy || !canEdit} onClick={() => pick(o.mode)}
            className={`rounded-lg border p-3 text-left transition disabled:cursor-not-allowed ${mode === o.mode ? "border-neutral-900 ring-1 ring-neutral-900 dark:border-white dark:ring-white" : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${mode === o.mode ? "border-neutral-900 dark:border-white" : "border-neutral-300"}`}>{mode === o.mode && <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white" />}</span>
              {o.title}
            </div>
            <p className="mt-1 pl-[22px] text-[12.5px] text-neutral-500">{o.body}</p>
          </button>
        ))}
      </div>
      {!canEdit && <p className="mt-2 text-[12px] text-neutral-500">Only owners and admins can change this.</p>}
      {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
    </div>
  );
}
