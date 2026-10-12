"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Propose + AI-generate evals for the customer's AI feature and save them as drafts. */
export function AgentGenerate({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [featureContext, setFeatureContext] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [mode, setMode] = useState<"suite" | "specs">("suite");
  const [requestField, setRequestField] = useState("");
  const [responsePath, setResponsePath] = useState("");
  const [aiGrading, setAiGrading] = useState(false);
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
        body: JSON.stringify({
          featureContext: featureContext.trim(),
          endpoint: endpoint.trim() || undefined,
          mode,
          ...(mode === "suite" ? { requestField: requestField.trim() || undefined, responsePath: responsePath.trim() || undefined, aiGrading } : {}),
        }),
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
      <p className="mt-0.5 text-xs text-neutral-500">Describe your AI feature and (optionally) its endpoint. Verity writes eval cases you review, then commit.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Eval format">
        {([
          ["suite", "Scored eval suite", "Recommended. One file: built-in prompt-injection & PII checks plus cases for your feature. Each case repeats 3× on Full regression, so inconsistent answers show as flaky."],
          ["specs", "Playwright eval specs", "One API test file per case. Best for exact, code-level checks (tool calls, JSON schemas)."],
        ] as const).map(([key, label, blurb]) => (
          <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => setMode(key)}
            className={`border p-3 text-left transition ${mode === key ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30" : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800"}`}>
            <span className="text-sm font-medium">{label}</span>
            <span className="mt-0.5 block text-[11px] text-neutral-500">{blurb}</span>
          </button>
        ))}
      </div>
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
        {mode === "suite" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={requestField}
              onChange={(e) => setRequestField(e.target.value)}
              placeholder="Request field for the message (default: message)"
              className="w-full border border-neutral-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-neutral-700"
            />
            <input
              value={responsePath}
              onChange={(e) => setResponsePath(e.target.value)}
              placeholder="Reply path in the JSON response, e.g. data.answer (default: auto)"
              className="w-full border border-neutral-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-neutral-700"
            />
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input type="checkbox" checked={aiGrading} onChange={(e) => setAiGrading(e.target.checked)} />
              <span><strong>Allow AI-graded checks</strong> <span className="text-neutral-400">— rubric scoring for properties a substring can&apos;t capture; needs a grader key in CI</span></span>
            </label>
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={generate} disabled={busy} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {busy ? "Proposing & generating…" : mode === "suite" ? "Generate eval suite" : "Generate evals"}
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
