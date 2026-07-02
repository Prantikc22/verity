"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Verify draft UI tests in a real browser (run + self-heal on the Fly runner),
 * then mark each Verified (active) or Needs review (quarantined). This is what
 * makes generated tests trustworthy instead of guessed.
 */
export function VerifyDrafts({ projectId, draftCount }: { projectId: string; draftCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/verify-tests`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      const s = data.summary;
      setMsg({ ok: true, text: s ? `Verified ${s.verified}/${s.total} in a real browser${s.needsReview ? ` · ${s.needsReview} need review` : " 🎉"}` : (data.message ?? "Nothing to verify.") });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Verification failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={verify}
        disabled={busy || draftCount === 0}
        title={draftCount === 0 ? "No draft UI tests to verify" : "Run the drafts in a real browser and self-heal failures"}
        className="border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
      >
        {busy ? "Verifying in a real browser…" : `✓ Verify ${draftCount} draft${draftCount === 1 ? "" : "s"}`}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
    </div>
  );
}
