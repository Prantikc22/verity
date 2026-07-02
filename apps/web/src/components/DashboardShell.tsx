"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusDot } from "@/components/StatusDot";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "M3 12l2-2 7-7 7 7 2 2M5 10v10h14V10" },
  { href: "/dashboard/trends", label: "Trends", icon: "M3 17l6-6 4 4 8-8" },
  { href: "/dashboard/usage", label: "Usage", icon: "M3 3v18h18M7 14l3-3 3 3 5-6" },
  { href: "/dashboard/github", label: "GitHub App", icon: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 00-.9-2.6c3-.3 6.2-1.5 6.2-6.7A5.2 5.2 0 0019 4.8 4.9 4.9 0 0018.9 1S17.7.6 15 2.5a13.4 13.4 0 00-7 0C5.3.6 4.1 1 4.1 1A4.9 4.9 0 004 4.8a5.2 5.2 0 00-1.4 3.6c0 5.2 3.2 6.4 6.2 6.7A3.4 3.4 0 008 17.7V22" },
  { href: "/dashboard/team", label: "Team", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" },
];
const DOCS = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs#github", label: "GitHub Action" },
  { href: "/docs#cli", label: "CLI" },
  { href: "/docs#predictions", label: "Predictions" },
];

// Project sub-sections, shown in the sidebar when inside a project.
// Project nav, grouped so UI testing and API testing never blur together.
const PROJECT_GROUPS: { heading?: string; items: { seg: string; label: string; icon: string }[] }[] = [
  { items: [
    { seg: "", label: "Overview", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
    { seg: "predictions", label: "Predictions", icon: "M3 17l6-6 4 4 8-8M14 7h7v7" },
  ] },
  { heading: "UI testing", items: [
    { seg: "generate", label: "Generate", icon: "M12 2v20M2 12h20" },
    { seg: "tests", label: "Tests", icon: "M9 11l3 3 8-8M4 4v16h16" },
    { seg: "cloud", label: "Cloud run", icon: "M6 16a4 4 0 010-8 5 5 0 019.6-1.6A4.5 4.5 0 1118 16z" },
  ] },
  { heading: "API testing", items: [
    { seg: "api/generate", label: "Generate", icon: "M12 2v20M2 12h20" },
    { seg: "api/tests", label: "Tests", icon: "M4 7h16M4 12h16M4 17h10" },
    { seg: "api/run", label: "Cloud run", icon: "M6 16a4 4 0 010-8 5 5 0 019.6-1.6A4.5 4.5 0 1118 16z" },
    { seg: "api/results", label: "Coverage & results", icon: "M3 12h4l3 8 4-16 3 8h4" },
  ] },
  { heading: "Visual testing", items: [
    { seg: "visual", label: "Snapshots", icon: "M4 5h16v14H4zM4 15l4-4 3 3 5-5 4 4" },
  ] },
  { heading: "Agent (AI) testing", items: [
    { seg: "agent", label: "Evals", icon: "M12 2a3 3 0 013 3v1a3 3 0 01-1 6H10a3 3 0 01-1-6V5a3 3 0 013-3zM8 14h8v6H8z" },
  ] },
  { heading: "Performance", items: [
    { seg: "performance", label: "Results", icon: "M3 17l6-6 4 4 8-8M14 7h7v7" },
  ] },
  { heading: "Security", items: [
    { seg: "security", label: "Findings", icon: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" },
  ] },
  { heading: "Shared", items: [
    { seg: "ci", label: "CI Setup", icon: "M4 6h16M4 12h16M4 18h16M8 3v3M8 15v3M16 9v3" },
    { seg: "mcp", label: "Local / MCP", icon: "M4 17l6-6-6-6M12 19h8" },
    { seg: "runs", label: "Runs & healing", icon: "M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { seg: "settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14 2h-4l-.8 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1L10 22h4l.8-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z" },
  ] },
];

export function DashboardShell({
  org,
  plan,
  email,
  children,
}: {
  org: string;
  plan: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const projectId = pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1] ?? null;
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  // Collapsible nav groups. Default: UI testing + Shared (key actions) open;
  // the other disciplines collapsed so the rail isn't overwhelming. The group
  // matching the current page auto-opens regardless.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    "API testing": true,
    "Visual testing": true,
    "Agent (AI) testing": true,
    "Performance": true,
    "Security": true,
  });
  const toggleGroup = (key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale name while the new project's name loads
    setProjectName(null);
    createClient().from("projects").select("name").eq("id", projectId).maybeSingle()
      .then(({ data }) => { if (active) setProjectName(data?.name ?? null); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (email && posthog.__loaded) posthog.identify(email, { email });
  }, [email]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <Link href="/" className="min-w-0">
          <Logo />
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-neutral-400">a QAShift product</span>
        </Link>
        <div className="flex items-center gap-3">
          <StatusDot compact align="left" />
          <ThemeToggle />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Workspace</div>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${active ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                {n.label}
              </Link>
            );
          })}
        </nav>

        {projectId && (
          <>
            <div className="flex items-center justify-between px-2 pb-2 pt-6">
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-indigo-500" title={projectName ?? undefined}>{projectName ?? "Project"}</span>
              <Link href="/dashboard" className="text-[10px] text-neutral-400 hover:text-neutral-600">switch</Link>
            </div>
            {PROJECT_GROUPS.map((group, gi) => {
              const key = group.heading ?? `g${gi}`;
              // Groups with a heading are collapsible; the ungrouped top items
              // (Overview/Predictions) always show. A group is open when any of
              // its routes is active, regardless of the manual toggle.
              const hasActive = group.items.some((n) => pathname === `/dashboard/projects/${projectId}${n.seg ? `/${n.seg}` : ""}`);
              const isOpen = !group.heading || !collapsed[key] || hasActive;
              return (
                <nav key={gi} className="mt-2 space-y-1">
                  {group.heading && (
                    <button
                      onClick={() => toggleGroup(key)}
                      className="flex w-full items-center justify-between px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      {group.heading}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isOpen ? "" : "-rotate-90"}`}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                  )}
                  {isOpen && group.items.map((n) => {
                    const href = `/dashboard/projects/${projectId}${n.seg ? `/${n.seg}` : ""}`;
                    const active = pathname === href;
                    return (
                      <Link
                        key={n.seg || "overview"}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${active ? "bg-indigo-600 text-white" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                        {n.label}
                      </Link>
                    );
                  })}
                </nav>
              );
            })}
          </>
        )}

        <div className="px-2 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Docs</div>
        <nav className="space-y-1">
          {DOCS.map((d) => (
            <Link key={d.href} href={d.href} onClick={() => setOpen(false)} className="block px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              {d.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-3 text-xs">
          <div className="truncate font-medium">{org}</div>
          <div className="truncate text-neutral-400">{email}</div>
          <div className="mt-1 inline-block bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-900">{plan} plan</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="flex-1 border border-neutral-300 px-2 py-1.5 text-center text-xs dark:border-neutral-700">Upgrade</Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-neutral-200 lg:block dark:border-neutral-800">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 lg:hidden dark:border-neutral-800">
          <Link href="/"><Logo /></Link>
          <button onClick={() => setOpen((o) => !o)} className="border border-neutral-300 p-2 dark:border-neutral-700" aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
        {open && <div className="border-b border-neutral-200 lg:hidden dark:border-neutral-800">{sidebar}</div>}

        <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
