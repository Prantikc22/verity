"use client";

import { useState } from "react";

export function PushAll({ projectId, repoLinked }: { projectId: string; repoLinked: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; url?: string } | null>(null);

  async function push() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tests/push-all`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Push failed.");
      setMsg({ ok: true, text: `Opened a PR with ${data.count} test${data.count === 1 ? "" : "s"} →`, url: data.pr_url });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Push failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={push} disabled={busy || !repoLinked} title={repoLinked ? "" : "Link a GitHub repo first"}
        className="bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900">
        {busy ? "Pushing…" : "⤴ Push all to GitHub (1 PR)"}
      </button>
      {msg && (msg.url
        ? <a href={msg.url} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-indigo-600 underline">{msg.text}</a>
        : <span className={`max-w-xs text-right text-[11px] ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>)}
    </div>
  );
}
