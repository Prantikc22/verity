"use client";

import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusDot } from "@/components/StatusDot";
import { createClient } from "@/lib/supabase/client";

type Child = { href: string; label: string; external?: boolean };
type NavItem = { label: string; href?: string; children?: Child[] };

const NAV: NavItem[] = [
  {
    label: "Product",
    children: [
      { href: "/#how", label: "How it works" },
      { href: "/#coverage", label: "What Verity tests" },
      { href: "/#fde", label: "Human ownership" },
      { href: "/#security", label: "Security" },
    ],
  },
  {
    label: "Developers",
    children: [
      { href: "/mcp", label: "MCP Server" },
      { href: "/github", label: "GitHub App" },
      { href: "/docs", label: "Docs" },
    ],
  },
  { href: "/pricing", label: "Pricing" },
  {
    label: "Company",
    children: [
      { href: "https://qashifthq.com/about", label: "About", external: true },
      { href: "https://qashifthq.com/about#careers", label: "Careers", external: true },
      { href: "https://qashifthq.com/contact", label: "Contact", external: true },
      { href: "https://qashifthq.com", label: "QAShift platform", external: true },
    ],
  },
];

function Dropdown({ item }: { item: NavItem }) {
  return (
    <div className="group relative">
      <button className="inline-flex items-center gap-1 transition hover:text-neutral-900 dark:hover:text-white">
        {item.label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition group-hover:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100">
        <div className="flex flex-col border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
          {item.children!.map((c) =>
            c.external ? (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer" className="px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white">{c.label}</a>
            ) : (
              <a key={c.href} href={c.href} className="px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white">{c.label}</a>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

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
          {NAV.map((item) =>
            item.children ? (
              <Dropdown key={item.label} item={item} />
            ) : (
              <Link key={item.href} href={item.href!} className="transition hover:text-neutral-900 dark:hover:text-white">{item.label}</Link>
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
