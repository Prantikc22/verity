"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** AI-generate a Playwright visual (toHaveScreenshot) spec and save it as a draft. */
export function VisualGenerate({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState<string | null>(null);

  async function generate() {
    if (input.trim().length < 3) { setError("Enter a URL or describe the screen to snapshot."); return; }
    setBusy(true); setError(""); setOk(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/visual-tests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: input.trim(), needsAuth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate.");
      setOk(`Saved “${data.name}” as a draft (${data.assertionCount} snapshot${data.assertionCount === 1 ? "" : "s"}) — review it below, then commit it to your repo.`);
      setInput("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold">Generate a visual snapshot</h3>
      <p className="mt-0.5 text-xs text-neutral-500">Give a URL or describe a screen/state. Verity writes a Playwright <code>toHaveScreenshot</code> spec you review, then commit as the baseline.</p>
      <div className="mt-3 space-y-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://staging.example.com/pricing  —  or  —  the logged-in dashboard header"
          className="w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            <input type="checkbox" checked={needsAuth} onChange={(e) => setNeedsAuth(e.target.checked)} /> Needs login (reads TEST_USERNAME / TEST_PASSWORD)
          </label>
          <button onClick={generate} disabled={busy} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {busy ? "Generating…" : "Generate snapshot"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {ok && <p className="mt-2 text-xs text-emerald-600">{ok}</p>}
    </section>
  );
}
