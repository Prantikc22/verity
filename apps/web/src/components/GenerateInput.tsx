"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";

/**
 * Public "describe a flow or paste a URL → get a test" widget. Shows BOTH the
 * plain-English plan and the Playwright code. Output is real (the backend opens
 * the URL for locators); we never show fabricated example specs.
 */
export function GenerateInput() {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<string[] | null>(null);
  const [spec, setSpec] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [tab, setTab] = useState<"plan" | "code">("plan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim().length < 3) return;
    setBusy(true);
    setError("");
    setSpec(null);
    setPlan(null);
    try {
      if (posthog.__loaded) posthog.capture("test_generated_attempt");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setPlan(Array.isArray(data.plan) ? data.plan : []);
      setSpec(data.spec);
      setLive(!!data.used_live_context);
      setTab("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a URL, or describe a flow — e.g. “log in, add to cart, check out”"
          className="flex-1 border border-neutral-300 bg-white/70 px-4 py-3 text-sm outline-none backdrop-blur focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900/70 dark:focus:border-indigo-400"
        />
        <button type="submit" disabled={busy} className="border-0 bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50">
          {busy ? "Opening page…" : "Generate test"}
        </button>
      </form>

      {error && <p className="mt-3 text-left text-sm text-red-600">{error}</p>}

      <AnimatePresence>
        {spec && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden text-left">
            <div className="flex items-center justify-between border border-b-0 border-neutral-200 bg-neutral-100 px-2 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex">
                {(["plan", "code"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium transition ${tab === t ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400" : "text-neutral-500"}`}>
                    {t === "plan" ? "Plan (English)" : "Playwright code"}
                  </button>
                ))}
              </div>
              {live && <span className="px-3 text-[10px] font-medium text-emerald-600">✓ from your live page</span>}
            </div>

            {tab === "plan" ? (
              <ol className="max-h-96 list-decimal space-y-1.5 overflow-auto border border-neutral-200 bg-white p-4 pl-8 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                {(plan ?? []).map((s, i) => <li key={i} className="text-neutral-700 dark:text-neutral-300">{s}</li>)}
                {(!plan || plan.length === 0) && <li className="text-neutral-500">Plan unavailable for this generation.</li>}
              </ol>
            ) : (
              <pre className="max-h-96 overflow-auto border border-neutral-200 bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-200 dark:border-neutral-800"><code>{spec}</code></pre>
            )}

            <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <Link
                href={`/start?input=${encodeURIComponent(input.trim())}`}
                className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Create a free account to save &amp; run this →
              </Link>
              <span className="text-xs text-neutral-500">Saves it to a project, pushes to your repo, and runs in CI — where it self-heals and predicts risk.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
