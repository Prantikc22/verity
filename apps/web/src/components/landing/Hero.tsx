"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { GenerateInput } from "@/components/GenerateInput";
import { GeometricBackground } from "./GeometricBackground";
import { HeroPanel } from "./HeroPanel";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200 dark:border-neutral-900">
      <GeometricBackground />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-2 lg:pt-24">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item} className="mb-5 inline-flex items-center gap-2 border border-neutral-300 bg-white/60 px-3 py-1 text-xs font-medium text-neutral-600 backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300">
            <span className="h-1.5 w-1.5 bg-indigo-500" />
            A QAShift product · AI writes, engineers verify
          </motion.div>

          <motion.h1 variants={item} className="text-balance text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">
            Your test suite,
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-400">
              on autopilot.
            </span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
            Verity <strong className="text-neutral-900 dark:text-white">generates</strong> Playwright tests with AI,
            <strong className="text-neutral-900 dark:text-white"> heals</strong> their locators when your UI changes,
            tells <strong className="text-neutral-900 dark:text-white">flaky from broken</strong>, and
            <strong className="text-neutral-900 dark:text-white"> predicts</strong> what&apos;s risky — all in your CI.
            When you want it owned end-to-end, a <strong className="text-amber-600 dark:text-amber-400">forward-deployed engineer</strong> runs it for you.
          </motion.p>

          <motion.div variants={item} className="mt-8">
            <GenerateInput />
          </motion.div>

          <motion.div variants={item} className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5"><Dot /> Runs in your CI — we don&apos;t host your browsers</span>
            <span className="inline-flex items-center gap-1.5"><Dot /> MIT open-source core</span>
            <Link href="#how" className="underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200">See how it works ↓</Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
        >
          <HeroPanel />
        </motion.div>
      </div>
    </section>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 bg-emerald-500" />;
}
