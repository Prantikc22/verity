"use client";

import { motion } from "framer-motion";

const RUN_STEPS = [
  ["Page opened", "app.acme.dev/checkout", "bg-sky-400"],
  ["DOM grounded", "24 elements matched", "bg-violet-400"],
  ["Assertion checked", "Order total is visible", "bg-emerald-400"],
  ["Playwright run", "Passed in 3.8s", "bg-emerald-400"],
] as const;

export function VerificationShowcase() {
  return (
    <div className="relative mt-12 min-h-[600px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0d16] shadow-[0_45px_120px_-45px_rgba(79,70,229,.65)] sm:min-h-[640px]">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[100px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-indigo-600/20 blur-[110px]" />

      <div className="relative flex items-center gap-3 border-b border-white/[0.08] bg-black/20 px-4 py-3 sm:px-5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 font-mono text-[10px] text-neutral-500 sm:text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          verity.run/acme/checkout-release
        </div>
        <span className="hidden rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-300 sm:inline">LIVE RUN</span>
      </div>

      <div className="relative grid min-h-[548px] sm:grid-cols-[168px_1fr] sm:min-h-[588px]">
        <aside className="hidden border-r border-white/[0.08] bg-black/10 p-4 sm:block">
          <div className="mb-6 flex items-center gap-2 px-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">V</span>
            <span className="text-sm font-semibold text-white">Verity</span>
          </div>
          <div className="space-y-1 text-xs">
            {[
              ["Overview", false],
              ["Test runs", true],
              ["UI tests", false],
              ["API tests", false],
              ["Visual", false],
              ["Performance", false],
              ["Security", false],
            ].map(([label, active]) => (
              <div key={String(label)} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${active ? "bg-indigo-500/15 text-indigo-200" : "text-neutral-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-indigo-400" : "bg-neutral-700"}`} />
                {label}
              </div>
            ))}
          </div>
        </aside>

        <div className="relative min-w-0 p-4 pb-40 sm:p-6 sm:pb-44 lg:p-8 lg:pb-44">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                checkout.spec.ts <span className="text-neutral-700">/</span> critical path
              </div>
              <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Checkout survives the release</h3>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> VERIFIED · 3.8s
            </motion.div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121521]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <span className="text-[10px] font-medium text-neutral-500">LIVE PRODUCT</span>
                <span className="flex items-center gap-1.5 text-[9px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> connected</span>
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-semibold tracking-[0.18em] text-neutral-500">CHECKOUT</div>
                    <div className="mt-1 text-lg font-semibold text-white">Complete your order</div>
                  </div>
                  <div className="rounded-xl bg-indigo-400/10 px-3 py-2 text-right">
                    <div className="text-[9px] text-indigo-300">TOTAL</div>
                    <div className="font-mono text-sm text-white">$128.00</div>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.025]" />
                  <div className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.025]" />
                </div>
                <motion.div
                  className="relative mt-4 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-semibold text-white"
                  animate={{ boxShadow: ["0 0 0 rgba(99,102,241,0)", "0 0 32px rgba(99,102,241,.32)", "0 0 0 rgba(99,102,241,0)"] }}
                  transition={{ duration: 3.4, repeat: Infinity }}
                >
                  Place order
                  <span className="absolute -right-2 -top-3 rounded-full border border-violet-300/20 bg-[#211b35] px-2.5 py-1 font-mono text-[8px] text-violet-200">role=button</span>
                </motion.div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#10131d] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">Evidence</span>
                <span className="text-[9px] text-neutral-600">4 signals</span>
              </div>
              <div className="mt-4 space-y-4">
                {RUN_STEPS.map(([label, detail, tone], index) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.13 }}
                    className="flex items-start gap-3"
                  >
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-200">{label}</div>
                      <div className="mt-0.5 truncate text-[10px] text-neutral-500">{detail}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-5 left-4 right-4 overflow-hidden rounded-2xl border border-white/10 bg-[#070910]/95 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:left-6 sm:right-6 lg:left-8 lg:right-8"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
              <span className="font-mono text-[10px] text-neutral-500">generated/checkout.spec.ts</span>
              <span className="text-[9px] font-semibold text-emerald-300">EXECUTED, NOT GUESSED</span>
            </div>
            <div className="overflow-x-auto px-4 py-3 font-mono text-[10px] leading-5 text-neutral-400 sm:px-5 sm:text-[11px]">
              <div><span className="text-violet-300">await</span> page.goto(<span className="text-emerald-300">&apos;/checkout&apos;</span>);</div>
              <div><span className="text-violet-300">await</span> page.getByRole(<span className="text-emerald-300">&apos;button&apos;</span>, &#123; name: <span className="text-emerald-300">&apos;Place order&apos;</span> &#125;).click();</div>
              <div><span className="text-violet-300">await</span> expect(page.getByText(<span className="text-emerald-300">&apos;Order confirmed&apos;</span>)).toBeVisible();</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
