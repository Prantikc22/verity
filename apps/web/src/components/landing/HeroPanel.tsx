"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Illustrative product panel — cycles through Verity's loop: generate → run →
 * flake caught → locator healed → predict. Purely a UI illustration of how the
 * product works (no traction metrics, no customer data).
 */
const STAGES = [
  {
    tag: "1 · Generate",
    color: "text-indigo-400",
    lines: [
      { t: "$ verity generate \"checkout with saved card\"", c: "text-neutral-400" },
      { t: "✓ tests/checkout.spec.ts", c: "text-indigo-300" },
      { t: "  await page.getByRole('button',", c: "text-neutral-300" },
      { t: "    { name: 'Place order' }).click()", c: "text-neutral-300" },
    ],
  },
  {
    tag: "2 · Run in CI",
    color: "text-sky-400",
    lines: [
      { t: "$ verity run --tier fast", c: "text-neutral-400" },
      { t: "Quick check · 12 specs · diff-aware", c: "text-amber-300" },
      { t: "✓ 11 passed", c: "text-emerald-300" },
      { t: "⟳ 1 retried (suspect)…", c: "text-amber-300" },
    ],
  },
  {
    tag: "3 · Flake vs real",
    color: "text-amber-400",
    lines: [
      { t: "rerun ×3 → pass, fail, pass", c: "text-neutral-400" },
      { t: "→ flaky, not broken", c: "text-amber-300" },
      { t: "quarantined from the verdict ✓", c: "text-emerald-300" },
      { t: "PR not blocked on noise", c: "text-neutral-300" },
    ],
  },
  {
    tag: "4 · Self-heal",
    color: "text-violet-400",
    lines: [
      { t: "selector broke after UI change", c: "text-neutral-400" },
      { t: "- getByTestId('cta-buy')", c: "text-red-400" },
      { t: "+ getByRole('button',{name:'Buy'})", c: "text-emerald-300" },
      { t: "suggested as a diff — you approve", c: "text-violet-300" },
    ],
  },
  {
    tag: "5 · Predict",
    color: "text-emerald-400",
    lines: [
      { t: "src/checkout.ts flagged", c: "text-neutral-400" },
      { t: "high historical regression rate", c: "text-amber-300" },
      { t: "posted inline in the PR", c: "text-emerald-300" },
      { t: "review the risky path first", c: "text-neutral-300" },
    ],
  },
];

export function HeroPanel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % STAGES.length), 2600);
    return () => clearInterval(id);
  }, []);
  const s = STAGES[i];

  return (
    <div className="relative">
      {/* offset shadow frame for depth */}
      <div className="absolute -right-3 -top-3 h-full w-full border border-indigo-500/30" aria-hidden />
      <div className="relative border border-neutral-700 bg-neutral-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
          <span className="h-2.5 w-2.5 bg-red-500/80" />
          <span className="h-2.5 w-2.5 bg-amber-500/80" />
          <span className="h-2.5 w-2.5 bg-emerald-500/80" />
          <span className="ml-2 font-mono text-xs text-neutral-500">verity — the loop</span>
        </div>

        <div className="flex gap-1 border-b border-neutral-800 px-3 py-2">
          {STAGES.map((st, idx) => (
            <span key={st.tag} className={`px-2 py-0.5 text-[10px] font-medium transition ${idx === i ? `${st.color} bg-white/5` : "text-neutral-600"}`}>
              {st.tag}
            </span>
          ))}
        </div>

        <div className="h-44 px-4 py-3 font-mono text-[13px] leading-relaxed">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.tag}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              {s.lines.map((l, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.12 }}
                  className={l.c}
                >
                  {l.t}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-2 text-[11px] text-neutral-500">
          <span>AI writes · the suite heals itself</span>
          <span className="text-amber-400">an FDE owns it →</span>
        </div>
      </div>
    </div>
  );
}
