"use client";

import { motion } from "framer-motion";

const NODES = [
  { t: "PR commit", d: "every push", accent: "border-neutral-400" },
  { t: "Quick check", d: "diff-aware subset · fast · never blocks", accent: "border-amber-400 text-amber-700 dark:text-amber-300" },
  { t: "Self-heal + flake triage", d: "fix locators · flaky ≠ broken", accent: "border-violet-400 text-violet-700 dark:text-violet-300" },
  { t: "Merge → Full regression", d: "entire suite · the safety net · can block", accent: "border-indigo-500 text-indigo-700 dark:text-indigo-300" },
  { t: "Predictions in the PR", d: "regression risk · deploy confidence", accent: "border-emerald-400 text-emerald-700 dark:text-emerald-300" },
];

export function Pipeline() {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {NODES.map((n, i) => (
        <motion.div
          key={n.t}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="relative"
        >
          <div className={`h-full border-l-2 ${n.accent} bg-neutral-50 p-4 dark:bg-neutral-900/40`}>
            <div className="font-mono text-[11px] text-neutral-400">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-1 text-sm font-semibold">{n.t}</div>
            <div className="mt-1 text-xs text-neutral-500">{n.d}</div>
          </div>
          {i < NODES.length - 1 && (
            <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-neutral-300 md:block dark:text-neutral-700" aria-hidden>→</div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
