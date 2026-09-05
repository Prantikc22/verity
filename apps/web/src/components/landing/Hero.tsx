"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { GenerateInput } from "@/components/GenerateInput";
import { GeometricBackground } from "./GeometricBackground";
import { HeroPanel } from "./HeroPanel";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.58, ease: "easeOut" } },
};

const PROOF = [
  ["01", "Live DOM grounded"],
  ["02", "Playwright-native"],
  ["03", "Run before trust"],
] as const;

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#070810] text-white">
      <GeometricBackground />

      <div className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.04fr_.96fr] lg:px-10 lg:py-28">
        <motion.div variants={container} initial="hidden" animate="show" className="relative z-10">
          <motion.div
            variants={item}
            className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-indigo-300/20 bg-indigo-300/[0.07] px-3.5 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-xl"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            The test suite your sprint never had time to write
          </motion.div>

          <motion.h1
            variants={item}
            className="max-w-3xl text-balance text-[3.4rem] font-semibold leading-[0.94] tracking-[-0.055em] sm:text-7xl lg:text-[5.25rem]"
          >
            Ship with proof.
            <span className="mt-1 block bg-gradient-to-r from-indigo-300 via-white to-violet-300 bg-clip-text text-transparent">
              Not hope.
            </span>
          </motion.h1>

          <motion.p variants={item} className="mt-7 max-w-2xl text-lg leading-relaxed text-neutral-300 sm:text-xl">
            You changed the code. Did anything break? Verity writes the end-to-end tests your team never gets to, runs them against the real app, and shows exactly what failed—before a user does.
          </motion.p>

          <motion.div variants={item} className="mt-9 max-w-2xl">
            <GenerateInput tone="hero" />
          </motion.div>

          <motion.div variants={item} className="mt-8 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/10 pt-5">
            {PROOF.map(([number, label]) => (
              <div key={number} className="min-w-0">
                <span className="font-mono text-[10px] text-indigo-300/70">{number}</span>
                <div className="mt-1 truncate text-xs font-medium text-neutral-300 sm:text-sm">{label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="relative z-10 lg:translate-x-2"
          initial={{ opacity: 0, x: 28, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.72, ease: "easeOut", delay: 0.18 }}
        >
          <HeroPanel />
        </motion.div>
      </div>

      <div className="relative border-t border-white/[0.08] bg-white/[0.025] backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-6 py-4 text-xs text-neutral-400 sm:flex-row sm:items-center lg:px-10">
          <span>Built for UI, API, visual, agent, performance and security testing.</span>
          <Link href="#how" className="group inline-flex items-center gap-2 font-medium text-white transition hover:text-indigo-200">
            See the verification loop <span className="transition group-hover:translate-y-0.5">↓</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
