"use client";

import { motion } from "framer-motion";

/**
 * Atmospheric hero treatment. Deliberately avoids grids and repeated patterns:
 * the depth comes from light, soft orbital lines, and slow-moving colour fields.
 */
export function GeometricBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#070810]" />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 14% 18%, rgba(99,102,241,.30), transparent 32%), radial-gradient(circle at 82% 32%, rgba(139,92,246,.24), transparent 30%), radial-gradient(circle at 58% 106%, rgba(14,165,233,.13), transparent 36%)",
        }}
      />

      <motion.div
        className="absolute -left-28 top-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-[90px]"
        animate={{ x: [0, 54, 0], y: [0, -28, 0], scale: [1, 1.14, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-16 top-8 h-96 w-96 rounded-full bg-violet-500/15 blur-[100px]"
        animate={{ x: [0, -40, 0], y: [0, 42, 0], scale: [1.08, 0.94, 1.08] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute left-[47%] top-1/2 h-[720px] w-[720px] -translate-y-1/2 rounded-full border border-white/[0.055]" />
      <div className="absolute left-[53%] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full border border-indigo-300/[0.07]" />
      <div className="absolute left-[62%] top-1/2 h-[280px] w-[280px] -translate-y-1/2 rounded-full border border-violet-300/[0.08]" />

      <motion.div
        className="absolute left-[48%] top-[12%] h-px w-[68%] origin-left rotate-[22deg] bg-gradient-to-r from-transparent via-indigo-300/20 to-transparent blur-[1px]"
        animate={{ opacity: [0.35, 0.8, 0.35], scaleX: [0.85, 1.05, 0.85] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#070810] to-transparent" />
    </div>
  );
}
