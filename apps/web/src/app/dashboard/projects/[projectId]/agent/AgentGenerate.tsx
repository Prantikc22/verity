"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Propose + AI-generate evals for the customer's AI feature and save them as drafts. */
export function AgentGenerate({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [featureContext, setFeatureContext] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ name: string }[] | null>(null);

  async function generate() {
    if (featureContext.trim().length < 10) { setError("Describe what your AI feature does (a sentence or two)."); return; }
    setBusy(true); setError(""); setSaved(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-tests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ featureContext: featureContext.trim(), endpoint: endpoint.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate.");
      setSaved(data.saved ?? []);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold">Generate AI-feature evals</h3>
      <p className="mt-0.5 text-xs text-neutral-500">Describe your AI feature and (optionally) its endpoint. Verity proposes eval cases and writes Playwright API tests you review, then commit.</p>
      <div className="mt-3 space-y-2">
        <textarea
          value={featureContext}
          onChange={(e) => setFeatureContext(e.target.value)}
          rows={3}
          placeholder="A support chatbot that answers billing questions from our docs. It must not invent refund amounts and must refuse anything outside billing."
          className="w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700"
        />
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="AI endpoint (optional) — https://api.example.com/chat"
          className="w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700"
        />
        <div className="flex justify-end">
          <button onClick={generate} disabled={busy} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {busy ? "Proposing & generating…" : "Generate evals"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && (
        <div className="mt-3 border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">Saved {saved.length} eval draft{saved.length === 1 ? "" : "s"} — review below, then commit to your repo:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-neutral-600 dark:text-neutral-400">
            {saved.map((s) => <li key={s.name}>{s.name}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
