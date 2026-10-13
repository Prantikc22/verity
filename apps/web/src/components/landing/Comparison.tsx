"use client";

import { motion } from "framer-motion";

const COLS = ["Verity", "DIY Playwright", "AI per-test tools", "Managed QA agency"];

const ROWS: { label: string; cells: (boolean | string)[] }[] = [
  { label: "AI generates the tests", cells: [true, false, true, "manual"] },
  { label: "UI, API, visual, AI-agent, load & security", cells: [true, false, "usually UI + API", "varies"] },
  { label: "Self-healing locators", cells: ["from Pro", false, "some", "manual"] },
  { label: "Flaky ≠ broken (auto-triage)", cells: [true, false, "rare", "manual"] },
  { label: "Runs in your own CI", cells: [true, true, "sometimes", false] },
  { label: "Regression & risk predictions", cells: ["managed plans", false, false, false] },
  { label: "A human engineer owns the suite", cells: ["managed plans", false, false, true] },
  { label: "Unlimited runs in your CI", cells: [true, "free but DIY", "credits per run", "retainer"] },
  { label: "You own the code", cells: [true, true, "varies", "varies"] },
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true)
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </span>
    );
  if (v === false)
    return (
      <span className="inline-flex items-center text-neutral-300 dark:text-neutral-700">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </span>
    );
  return <span className="text-xs text-neutral-500">{v}</span>;
}

export function Comparison() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="overflow-x-auto border border-neutral-200 dark:border-neutral-800"
    >
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
            <th className="p-4 font-medium text-neutral-400"></th>
            {COLS.map((c, i) => (
              <th key={c} className={`p-4 font-semibold ${i === 0 ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-500"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
              <td className="p-4 font-medium text-neutral-600 dark:text-neutral-300">{r.label}</td>
              {r.cells.map((c, idx) => (
                <td key={idx} className={`p-4 ${idx === 0 ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}><Cell v={c} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
