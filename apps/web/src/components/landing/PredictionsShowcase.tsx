"use client";

import { motion } from "framer-motion";

/**
 * The intelligence layer — a dark, console-style showcase. Visuals are schematic
 * illustrations of how each prediction reads (marked "Schematic"), not live data.
 * Two predictions are Live today; two are Calibrating (they switch on once a
 * project has enough run history). No "GA/Beta" jargon.
 */

function StatusPill({ live }: { live: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${live ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}`}>
      <span className={`h-1.5 w-1.5 ${live ? "bg-emerald-400" : "bg-amber-400"} ${live ? "animate-pulse" : ""}`} />
      {live ? "Live" : "Calibrating"}
    </span>
  );
}

function RiskBars() {
  const rows = [
    { f: "src/checkout.ts", v: 0.82 },
    { f: "src/auth/session.ts", v: 0.54 },
    { f: "src/cart.ts", v: 0.28 },
    { f: "src/utils/format.ts", v: 0.08 },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.f} className="flex items-center gap-3">
          <span className="w-36 truncate font-mono text-[11px] text-neutral-400">{r.f}</span>
          <div className="relative h-2 flex-1 bg-neutral-800">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${r.v * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              className={`absolute inset-y-0 left-0 ${r.v > 0.5 ? "bg-red-500" : r.v > 0.25 ? "bg-amber-500" : "bg-emerald-500"}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FlakeSplit() {
  return (
    <div className="flex items-end gap-4">
      <div className="flex-1">
        <div className="flex h-24 items-end gap-1">
          {[0.9, 0.2, 0.85, 0.3, 0.95, 0.25, 0.8].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${h * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={i % 2 === 0 ? "flex-1 bg-emerald-500" : "flex-1 bg-amber-500"}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
          <span className="text-emerald-400">● real</span>
          <span className="text-amber-400">● flaky → quarantined</span>
        </div>
      </div>
    </div>
  );
}

function CorrelationGraph() {
  const nodes = [
    { x: 20, y: 30, l: "regression" },
    { x: 80, y: 20, l: "failure" },
    { x: 55, y: 70, l: "flake" },
  ];
  return (
    <svg viewBox="0 0 100 90" className="h-28 w-full">
      <line x1="20" y1="30" x2="80" y2="20" stroke="#6366f1" strokeWidth="1.2" />
      <line x1="80" y1="20" x2="55" y2="70" stroke="#8b5cf6" strokeWidth="0.8" strokeDasharray="2 2" />
      <line x1="20" y1="30" x2="55" y2="70" stroke="#8b5cf6" strokeWidth="0.6" strokeDasharray="2 2" />
      {nodes.map((n, i) => (
        <g key={n.l}>
          <motion.circle
            cx={n.x} cy={n.y} r="4"
            initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            fill="#a5b4fc"
          />
          <text x={n.x} y={n.y - 6} fontSize="5" fill="#9ca3af" textAnchor="middle">{n.l}</text>
        </g>
      ))}
    </svg>
  );
}

function ConfidenceDial() {
  const score = 0.78;
  const r = 34;
  const circ = Math.PI * r; // half circle
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 90 50" className="h-24 w-40">
        <path d="M11 45 A34 34 0 0 1 79 45" fill="none" stroke="#27272a" strokeWidth="7" />
        <motion.path
          d="M11 45 A34 34 0 0 1 79 45"
          fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="square"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          whileInView={{ strokeDashoffset: circ * (1 - score) }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        />
      </svg>
      <div className="-mt-3 text-2xl font-semibold text-white">78<span className="text-sm text-neutral-500">/100</span></div>
      <div className="text-[10px] text-neutral-500">decomposed across 4 signals</div>
    </div>
  );
}

const CARDS = [
  { live: true, t: "Regression-prone modules", d: "Files with a high historical regression rate for similar changes — flagged inline in the PR, before review.", viz: <RiskBars /> },
  { live: true, t: "Flaky vs. real failures", d: "Every failure is scored against its own flake history, so noise is quarantined and real blockers stand out.", viz: <FlakeSplit /> },
  { live: false, t: "Cross-dimension correlation", d: "How regression, failure and flake signals move together across deploys. Switches on once there's enough history.", viz: <CorrelationGraph /> },
  { live: false, t: "Deploy confidence score", d: "One decomposed score per deploy. Calibrates against your history before it's shown — never a number you can't trust.", viz: <ConfidenceDial /> },
];

export function PredictionsShowcase() {
  return (
    <section id="predictions" className="scroll-mt-24 relative overflow-hidden bg-neutral-950 py-24 text-white">
      {/* grid backdrop */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]" aria-hidden>
        <defs><pattern id="pgrid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="white" strokeWidth="1" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#pgrid)" />
      </svg>
      <div className="absolute left-1/2 top-0 h-72 w-[700px] -translate-x-1/2 bg-indigo-600/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-sm font-medium text-indigo-400">The intelligence layer</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Verity doesn&apos;t just run your tests. It tells you what&apos;s about to break.
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Every run feeds a model of your codebase: which files regress, which tests lie, and how risk compounds.
            Two signals are live today; two more switch on automatically once your project has enough history.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 2) * 0.08 }}
              className="group border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur transition hover:border-neutral-700"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{c.t}</h3>
                <StatusPill live={c.live} />
              </div>
              <p className="mt-2 text-sm text-neutral-400">{c.d}</p>
              <div className="mt-5 border-t border-neutral-800 pt-5">
                {c.viz}
                <div className="mt-3 text-right text-[10px] uppercase tracking-wide text-neutral-600">Schematic</div>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 max-w-2xl text-xs text-neutral-500">
          In the product, these surfaces show <span className="text-neutral-300">your real data</span> — and an honest empty
          state until there&apos;s enough of it. We never invent a number to fill a chart.
        </p>
      </div>
    </section>
  );
}
