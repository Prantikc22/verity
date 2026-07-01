"use client";

import { useState, useTransition } from "react";
import { resolveHealing } from "./actions";

interface HealingItem {
  id: string;
  old_selector: string;
  new_selector: string;
  confidence: number | null;
  status: "suggested" | "applied" | "rejected";
  created_at: string;
}

export function HealingReview({ projectId, events }: { projectId: string; events: HealingItem[] }) {
  const [items, setItems] = useState(events);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function resolve(id: string, status: "applied" | "rejected") {
    startTransition(async () => {
      const res = await resolveHealing(projectId, id, status);
      if (!res.ok) {
        setError(res.error ?? "Failed.");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    });
  }

  if (items.length === 0) {
    return <p className="mt-3 text-sm text-neutral-500">No locator healing suggestions yet. When a selector breaks during a run, Verity proposes a fix here for your review.</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.map((h) => (
        <div key={h.id} className="border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              {typeof h.confidence === "number" ? `${Math.round(h.confidence * 100)}% confidence` : "—"} · {new Date(h.created_at).toLocaleDateString()}
            </span>
            <span className={`border px-2 py-0.5 text-[11px] font-medium ${h.status === "suggested" ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300" : h.status === "applied" ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300" : "border-neutral-300 text-neutral-500 dark:border-neutral-700"}`}>
              {h.status}
            </span>
          </div>
          <pre className="mt-2 overflow-x-auto border border-neutral-200 bg-neutral-950 p-3 text-xs dark:border-neutral-800">
            <div className="text-red-400">- {h.old_selector}</div>
            <div className="text-emerald-400">+ {h.new_selector}</div>
          </pre>
          <p className="mt-2 text-[11px] text-neutral-500">Suggested only — Verity never writes this into your source. Apply the diff in your repo, then mark it here.</p>
          {h.status === "suggested" && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => resolve(h.id, "applied")} disabled={pending} className="bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Mark applied</button>
              <button onClick={() => resolve(h.id, "rejected")} disabled={pending} className="border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
