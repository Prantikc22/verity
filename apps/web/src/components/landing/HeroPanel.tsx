"use client";

import { motion } from "framer-motion";

const TRACE = [
  { n: "01", label: "Page opened", detail: "Authenticated", tone: "bg-sky-400" },
  { n: "02", label: "Element grounded", detail: "Live DOM", tone: "bg-violet-400" },
  { n: "03", label: "Code executed", detail: "Passed · 3.8s", tone: "bg-emerald-400" },
] as const;

export function HeroPanel() {
  return (
    <div className="relative mx-auto min-h-[570px] w-full max-w-[640px] sm:min-h-[610px]" aria-label="Verity live test verification example">
      {/* The visual dissolves into the hero rather than sitting in one hard frame. */}
      <div className="absolute inset-[8%] rounded-full bg-indigo-500/20 blur-[90px]" aria-hidden />
      <div className="absolute left-[10%] top-[8%] h-[78%] w-[78%] rounded-full border border-indigo-300/[0.08]" aria-hidden />
      <div className="absolute left-[17%] top-[15%] h-[64%] w-[64%] rounded-full border border-violet-300/[0.07]" aria-hidden />
      <motion.div
        className="absolute left-[13%] top-[17%] h-px w-[76%] origin-left rotate-[38deg] bg-gradient-to-r from-transparent via-violet-300/30 to-transparent"
        animate={{ opacity: [0.25, 0.75, 0.25], scaleX: [0.85, 1.08, 0.85] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Live target page */}
      <motion.div
        className="absolute inset-x-2 top-12 overflow-hidden rounded-[22px] border border-white/15 bg-[#10121e]/90 shadow-[0_34px_100px_-30px_rgba(0,0,0,.95)] backdrop-blur-2xl sm:left-12 sm:right-0"
        initial={{ opacity: 0, y: 24, rotate: 0.8 }}
        animate={{ opacity: 1, y: [0, -5, 0], rotate: 0.8 }}
        transition={{ opacity: { duration: 0.6 }, y: { duration: 8, repeat: Infinity, ease: "easeInOut" } }}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] bg-black/20 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/75" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/75" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/75" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 font-mono text-[10px] text-neutral-500 sm:text-[11px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="truncate">app.example.com/checkout</span>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-2 py-1 text-[9px] font-semibold tracking-wide text-emerald-300">LIVE</span>
        </div>

        <div className="p-5 pb-7 sm:p-7 sm:pb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-medium tracking-[0.18em] text-neutral-500">CHECKOUT</div>
              <div className="mt-1 text-lg font-semibold text-white sm:text-xl">Complete your order</div>
            </div>
            <div className="rounded-xl border border-indigo-300/10 bg-indigo-300/[0.07] px-3 py-2 text-right">
              <div className="text-[9px] text-indigo-300">TOTAL</div>
              <div className="font-mono text-sm text-white">$128.00</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="h-11 rounded-xl border border-white/[0.075] bg-white/[0.025]" />
            <div className="h-11 rounded-xl border border-white/[0.075] bg-white/[0.025]" />
          </div>

          <div className="relative mt-5">
            <motion.div
              className="absolute -inset-1 rounded-xl border border-violet-300/45"
              animate={{ boxShadow: ["0 0 0 rgba(167,139,250,0)", "0 0 28px rgba(139,92,246,.28)", "0 0 0 rgba(167,139,250,0)"] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            <div className="relative flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 text-sm font-semibold text-white">
              Place order
            </div>
            <motion.div
              className="absolute -top-8 right-2 flex items-center gap-2 rounded-full border border-violet-300/20 bg-[#171426]/95 px-3 py-1.5 font-mono text-[9px] text-violet-200 shadow-xl backdrop-blur-xl sm:text-[10px]"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.4 }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              button · &quot;Place order&quot;
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Generated code lifts out of the target page. */}
      <motion.div
        className="absolute bottom-[36px] left-0 w-[88%] overflow-hidden rounded-2xl border border-white/10 bg-[#080a12]/95 shadow-[0_24px_70px_-20px_rgba(0,0,0,.95)] backdrop-blur-2xl sm:bottom-6 sm:left-1 sm:w-[82%]"
        initial={{ opacity: 0, x: -24, y: 18 }}
        animate={{ opacity: 1, x: 0, y: [0, 4, 0] }}
        transition={{ opacity: { delay: 0.35, duration: 0.55 }, x: { delay: 0.35, duration: 0.55 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-400/10 font-mono text-[9px] text-indigo-300">V</span>
            <span className="font-mono text-[10px] text-neutral-500">checkout.spec.ts</span>
          </div>
          <span className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wide text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> GROUNDED
          </span>
        </div>
        <div className="px-4 py-4 font-mono text-[10px] leading-6 sm:px-5 sm:text-[11px]">
          <div><span className="text-violet-300">await</span> <span className="text-neutral-300">page.getByRole</span><span className="text-neutral-500">(</span></div>
          <div className="pl-4 text-neutral-300">&apos;button&apos;, &#123; name: <span className="text-emerald-300">&apos;Place order&apos;</span> &#125;</div>
          <div className="text-neutral-300"><span className="text-neutral-500">)</span>.click<span className="text-neutral-500">();</span></div>
        </div>
      </motion.div>

      {/* Proof badge visually completes the flow. */}
      <motion.div
        className="absolute bottom-3 right-0 z-10 rounded-2xl border border-emerald-300/20 bg-[#101b1a]/95 p-3.5 shadow-[0_20px_55px_-22px_rgba(16,185,129,.55)] backdrop-blur-xl sm:bottom-14 sm:right-1 sm:p-4"
        initial={{ opacity: 0, scale: 0.88, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
        transition={{ opacity: { delay: 0.95, duration: 0.35 }, scale: { delay: 0.95, duration: 0.35 }, y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" } }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-sm text-emerald-300">✓</span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Verified</div>
            <div className="mt-0.5 text-xs font-medium text-white">Execution passed</div>
          </div>
        </div>
      </motion.div>

      {/* A compact trace makes the illustration feel like one system. */}
      <div className="absolute -right-1 top-1 hidden w-[176px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f1a]/80 p-3 shadow-xl backdrop-blur-2xl sm:block">
        <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Verification trace</div>
        <div className="space-y-2.5">
          {TRACE.map((step, i) => (
            <motion.div key={step.n} className="flex items-center gap-2.5" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.2 }}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${step.tone}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-medium text-neutral-200">{step.label}</div>
                <div className="truncate text-[9px] text-neutral-500">{step.detail}</div>
              </div>
              <span className="font-mono text-[8px] text-neutral-600">{step.n}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
