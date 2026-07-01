"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const KEY = "verity-cookie-consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) {
        const t = setTimeout(() => setShow(true), 700);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function decide(value: "all" | "essential") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5"
        >
          <div className="relative mx-auto flex max-w-5xl flex-col gap-4 border border-neutral-200 bg-white/90 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-950/90">
            <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500" />
            <div className="flex items-start gap-3 pl-2">
              <div className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center bg-indigo-600 sm:flex">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold">We value your privacy</p>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-500">
                  We use essential cookies to run Verity and optional analytics to improve the product.
                  You&apos;re in control — choose what you&apos;re comfortable with.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 pl-2 sm:pl-0">
              <button
                onClick={() => decide("essential")}
                className="flex-1 border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 sm:flex-none dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Essential only
              </button>
              <button
                onClick={() => decide("all")}
                className="flex-1 bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 sm:flex-none dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Accept all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
