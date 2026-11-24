"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Verify draft UI tests in a real browser on the Fly runner,
 * then mark each Verified (active) or Needs review (quarantined). This is what
 * makes generated tests trustworthy instead of guessed.
 */
export function VerifyDrafts({ projectId, draftCount, reviewIds = [] }: { projectId: string; draftCount: number; reviewIds?: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function verify(ids?: string[]) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/verify-tests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ids?.length ? { testIds: ids } : {}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      const s = data.summary;
      setMsg({ ok: !s || !s.needsReview, text: s ? `${s.verified} of ${s.total} passed in a real browser${s.autoFixed ? ` (${s.autoFixed} fixed automatically)` : ""}${s.needsReview ? `. ${s.needsReview} need${s.needsReview === 1 ? "s" : ""} review: open ${s.needsReview === 1 ? "it" : "one"} to see why.` : "."}` : (data.message ?? "Nothing to verify.") });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Verification failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {draftCount === 0 && reviewIds.length > 0 ? (
        <button onClick={() => verify(reviewIds)} disabled={busy}
          className="border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30">
          {busy ? "Checking in a real browser…" : `Check ${reviewIds.length} again`}
        </button>
      ) : (
      <button
        onClick={() => verify()}
        disabled={busy || draftCount === 0}
        title={draftCount === 0 ? "No draft UI tests to verify" : "Run the drafts in a real browser"}
        className="border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
      >
        {busy ? "Verifying in a real browser…" : `Verify ${draftCount} draft${draftCount === 1 ? "" : "s"}`}
      </button>
      )}
      {msg && <span role="status" className={`text-xs ${msg.ok ? "text-emerald-600" : "text-amber-700 dark:text-amber-400"}`}>{msg.text}</span>}
    </div>
  );
}
