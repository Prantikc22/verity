"use client";

import { motion } from "framer-motion";

/**
 * Animated geometric backdrop — grid, drifting squares, rotating outlines.
 * Sharp shapes only, to match the angular brand. Purely decorative.
 */
export function GeometricBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full opacity-[0.06] dark:opacity-[0.12]" aria-hidden>
        <defs>
          <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0H0V44" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div className="absolute left-1/2 top-[-12%] h-[460px] w-[820px] -translate-x-1/2 bg-gradient-to-br from-indigo-300/30 via-violet-300/20 to-transparent blur-3xl dark:from-indigo-500/10 dark:via-violet-500/10" />

      <motion.div
        className="absolute left-[8%] top-[22%] h-16 w-16 border-2 border-indigo-400/40"
        animate={{ y: [0, -18, 0], rotate: [0, 45, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[10%] top-[30%] h-10 w-10 bg-violet-400/20"
        animate={{ y: [0, 20, 0], rotate: [0, -30, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[20%] top-[12%] h-24 w-24 border-2 border-neutral-300/40 dark:border-neutral-700/60"
        animate={{ rotate: [0, 90, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute left-[18%] top-[8%] h-6 w-6 bg-indigo-400/30"
        animate={{ y: [0, 14, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.svg
        className="absolute left-[42%] top-[6%] h-12 w-12 text-violet-400/40"
        viewBox="0 0 100 100"
        animate={{ rotate: [0, 120, 240, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        aria-hidden
      >
        <polygon points="50,5 95,90 5,90" fill="none" stroke="currentColor" strokeWidth="4" />
      </motion.svg>
    </div>
  );
}
