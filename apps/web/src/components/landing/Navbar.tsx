"use client";

import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusDot } from "@/components/StatusDot";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#predictions", label: "Predictions" },
  { href: "#fde", label: "FDE" },
  { href: "#security", label: "Security" },
  { href: "/github", label: "GitHub App" },
  { href: "/mcp", label: "MCP Server" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [authed, setAuthed] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-40"
    >
      <div
        className={`mx-auto flex w-full max-w-6xl items-center justify-between px-6 transition-all duration-300 ${
          scrolled
            ? "my-2 border border-neutral-200/70 bg-white/70 py-2.5 shadow-sm backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/70"
            : "py-5"
        }`}
      >
        <Link href="/"><Logo /></Link>
        <nav className="hidden items-center gap-7 text-sm text-neutral-600 md:flex dark:text-neutral-300">
          {LINKS.map((l) =>
            l.href.startsWith("/") ? (
              <Link key={l.href} href={l.href} className="transition hover:text-neutral-900 dark:hover:text-white">{l.label}</Link>
            ) : (
              <a key={l.href} href={l.href} className="transition hover:text-neutral-900 dark:hover:text-white">{l.label}</a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block"><StatusDot /></span>
          {authed ? (
            <Link href="/dashboard" className="bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm text-neutral-600 hover:text-neutral-900 sm:block dark:text-neutral-300 dark:hover:text-white">Sign in</Link>
              <Link href="/login?next=/dashboard" className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500">Start free</Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </motion.header>
  );
}
