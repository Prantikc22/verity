"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { PROJECT_GROUPS, isActiveItem } from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";
import { LinkPending } from "./NavProgress";

/*
 * QAShift 2.0 workspace shell. One brand, one navigation:
 * Overview · Projects · Test Runs · Agents · Coverage · Reports · Integrations · Usage & Billing · Settings.
 * QAShift remains the internal engine name and is not shown here.
 */

const P = {
  overview: "M3 12l2-2 7-7 7 7 2 2M5 10v10h14V10",
  projects: "M3 7h6l2 2h10v10H3zM3 7V5h6l2 2",
  runs: "M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  agents: "M12 2a4 4 0 014 4v1h1a3 3 0 013 3v6a3 3 0 01-3 3H7a3 3 0 01-3-3v-6a3 3 0 013-3h1V6a4 4 0 014-4zM9 13h.01M15 13h.01",
  coverage: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
  reports: "M4 4h16v16H4zM8 16v-4M12 16V8M16 16v-6",
  integrations: "M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4",
  billing: "M2 6h20v12H2zM2 10h20M6 15h4",
  services: "M16 11a4 4 0 10-8 0M4 21v-1a6 6 0 0112 0v1M17 8a3 3 0 110 6M20 21v-1a5 5 0 00-3-4.6",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14 2h-4l-.8 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1L10 22h4l.8-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z",
};

export const WORKSPACE_NAV = [
  { href: "/dashboard", label: "Overview", icon: P.overview, also: [] as string[] },
  { href: "/dashboard/projects", label: "Projects", icon: P.projects, also: [] },
  { href: "/dashboard/runs", label: "Test Runs", icon: P.runs, also: [] },
  { href: "/dashboard/agents", label: "Agents", icon: P.agents, also: [] },
  { href: "/dashboard/coverage", label: "Coverage", icon: P.coverage, also: [] },
  { href: "/dashboard/reports", label: "Reports", icon: P.reports, also: ["/dashboard/trends"] },
  { href: "/dashboard/services", label: "Services", icon: P.services, also: [] },
  { href: "/dashboard/integrations", label: "Integrations", icon: P.integrations, also: ["/dashboard/github"] },
  { href: "/dashboard/usage", label: "Usage & Billing", icon: P.billing, also: [] },
  { href: "/dashboard/settings", label: "Settings", icon: P.settings, also: ["/dashboard/team"] },
];

/** Reports-only workspace: just what a team sending test results needs. */
export const REPORTS_NAV = [
  { href: "/dashboard/reports", label: "Reports", icon: P.reports, also: ["/dashboard/trends"] },
  { href: "/dashboard/runs", label: "Test Runs", icon: P.runs, also: [] as string[] },
  { href: "/dashboard/projects", label: "Projects", icon: P.projects, also: [] },
  { href: "/dashboard/services", label: "Services", icon: P.services, also: [] },
  { href: "/dashboard/usage", label: "Usage & Billing", icon: P.billing, also: [] },
  { href: "/dashboard/settings", label: "Settings", icon: P.settings, also: ["/dashboard/team"] },
];
const REPORTS_PROJECT_SEGS = new Set(["runs", "ci", "settings"]);

function AddAgents() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    const res = await fetch("/api/workspace/mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "full" }) });
    if (res.ok) { window.location.href = "/dashboard/agents"; return; }
    setErr((await res.json().catch(() => ({}))).error ?? "Couldn't switch. Try again.");
    setBusy(false);
  };
  return (
    <div className="mb-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-[12.5px] font-medium text-neutral-900 dark:text-neutral-100">Want tests written for you?</div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-500">AI agents write, run and fix tests. Same login, same data. Free to try.</p>
      <button type="button" onClick={go} disabled={busy} className="mt-2 w-full rounded-md bg-neutral-900 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900">
        {busy ? "Turning on…" : "Add AI agents"}
      </button>
      {err && <p className="mt-1.5 text-[11px] text-red-600">{err}</p>}
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Mark() {
  return (
    <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M 45.2 20.4 A 21 21 0 1 0 44.1 45.9" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <path d="M 19.5 32.5 L 28.5 41.5 L 57 13" fill="none" stroke="#22C55E" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QAShiftShell({ org, plan, email, credits, mode = "full", children }: { org: string; plan: string; email: string; credits?: { limit: number; used?: number; unlimited: boolean }; mode?: "full" | "reports"; children: React.ReactNode }) {
  const reportsOnly = mode === "reports";
  const NAV = reportsOnly ? REPORTS_NAV : WORKSPACE_NAV;
  const pathname = usePathname();
  const projectId = pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1] ?? null;
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale name while the new project's name loads
    setProjectName(null);
    createClient().from("projects").select("name").eq("id", projectId).maybeSingle()
      .then(({ data }) => { if (active) setProjectName(data?.name ?? null); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => { if (email && posthog.__loaded) posthog.identify(email, { email }); }, [email]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile menu on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (n: (typeof NAV)[number]) =>
    n.href === "/dashboard" ? pathname === "/dashboard"
      : n.href === "/dashboard/projects" ? pathname === "/dashboard/projects"
      : pathname === n.href || pathname.startsWith(`${n.href}/`) || n.also.some((a) => pathname.startsWith(a));

  const item = (active: boolean) =>
    `group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-[color,background-color,transform] duration-150 active:scale-[0.98] active:bg-neutral-900/[0.08] dark:active:bg-white/10 ${active
      ? "bg-neutral-900/[0.06] font-medium text-neutral-950 dark:bg-white/10 dark:text-white"
      : "text-neutral-600 hover:bg-neutral-900/[0.04] hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"}`;

  const sidebar = (
    <div className="flex h-full flex-col bg-[#FBFBFA] dark:bg-neutral-950">
      <div className="flex h-[52px] items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <Link href={reportsOnly ? "/dashboard/reports" : "/dashboard"} className="flex min-w-0 items-center gap-2 text-neutral-950 dark:text-white">
          <Mark />
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{org}</span>
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <nav aria-label="Workspace" className="space-y-px">
          {NAV.map((n) => {
            const active = isActive(n);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={item(active)}>
                <span className={active ? "text-neutral-950 dark:text-white" : "text-neutral-400 group-hover:text-neutral-700"}><Icon d={n.icon} /></span>{n.label}<LinkPending />
              </Link>
            );
          })}
        </nav>

        {projectId && (
          <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <div className="truncate px-2.5 pb-1.5 text-[12px] font-medium text-neutral-950 dark:text-white" title={projectName ?? undefined}>{projectName ?? "Project"}</div>
            {(reportsOnly
              ? [{ items: PROJECT_GROUPS.flatMap((g) => g.items).filter((n) => REPORTS_PROJECT_SEGS.has(n.seg)).map((n) => (n.seg === "ci" ? { ...n, label: "Connect tests" } : n)) }]
              : PROJECT_GROUPS).map((group: { heading?: string; items: typeof PROJECT_GROUPS[number]["items"] }, gi) => (
              <nav key={gi} className={`space-y-px ${gi ? "mt-3" : ""}`} aria-label={group.heading ?? "Project"}>
                {group.heading && <div className="px-2.5 pb-1 text-[11px] font-medium text-neutral-400">{group.heading}</div>}
                {group.items.map((n) => {
                  const href = `/dashboard/projects/${projectId}${n.seg ? `/${n.seg}` : ""}`;
                  const active = isActiveItem(pathname, projectId, n);
                  return (
                    <Link key={n.seg || "overview"} href={href} aria-current={active ? "page" : undefined} className={item(active)}>
                      <span className={active ? "text-violet-600" : "text-neutral-400 group-hover:text-neutral-700"}><Icon d={n.icon} /></span>{n.label}<LinkPending />
                    </Link>
                  );
                })}
              </nav>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        {reportsOnly && <AddAgents />}
        <Link href="/dashboard/usage" className="block rounded-md px-2.5 py-2 hover:bg-neutral-900/[0.04] dark:hover:bg-white/5">
          <div className="flex items-center justify-between text-[12px]"><span className="font-medium text-neutral-900 dark:text-neutral-100">{plan}</span><span className="text-neutral-400">Plan</span></div>
          {credits && !reportsOnly && (credits.unlimited ? (
            <div className="mt-1 text-[11.5px] text-neutral-500">Unlimited agent credits</div>
          ) : credits.used === undefined ? (
            <div className="mt-1 text-[11.5px] text-neutral-500">{credits.limit.toLocaleString("en-US")} agent credits / month</div>
          ) : (
            <>
              <div className="mt-1 flex items-baseline justify-between text-[11.5px] text-neutral-500">
                <span><b className="tnum font-medium text-neutral-800 dark:text-neutral-200">{Math.max(0, credits.limit - credits.used).toLocaleString("en-US")}</b> credits left</span>
                <span className="tnum">of {credits.limit.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className={`h-full rounded-full ${credits.used / Math.max(1, credits.limit) >= 0.9 ? "bg-red-500" : credits.used / Math.max(1, credits.limit) >= 0.7 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, Math.round((credits.used / Math.max(1, credits.limit)) * 100))}%` }} />
              </div>
            </>
          ))}
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2 px-2.5 pt-1">
          <span className="truncate text-[12px] text-neutral-500" title={email}>{email}</span>
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  const title = projectId ? projectName ?? "Project" : WORKSPACE_NAV.find(isActive)?.label ?? "Workspace";

  return (
    <div className="flex min-h-screen bg-[#F7F7F5] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r border-neutral-200 lg:block dark:border-neutral-800">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between gap-3 border-b border-neutral-200 bg-[#F7F7F5]/90 px-4 backdrop-blur lg:px-8 dark:border-neutral-800 dark:bg-neutral-950/90">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-neutral-200 p-1.5 lg:hidden dark:border-neutral-800" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={open ? "M6 6l12 12M18 6L6 18" : "M3 6h18M3 12h18M3 18h18"} /></svg>
            </button>
            <span className="truncate text-[13px] text-neutral-500">{projectId ? <><Link href="/dashboard/projects" className="hover:text-neutral-900">Projects</Link><span className="mx-1.5 text-neutral-300">/</span></> : null}<span className="font-medium text-neutral-900 dark:text-white">{title}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs" className="hidden h-8 items-center rounded-md px-2.5 text-[13px] text-neutral-600 hover:bg-neutral-900/[0.04] hover:text-neutral-950 sm:inline-flex dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white">Docs</Link>
            <Link href="/dashboard/projects" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-950 px-3 text-[13px] font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New project
            </Link>
          </div>
        </header>
        {open && <div className="border-b border-neutral-200 lg:hidden dark:border-neutral-800">{sidebar}</div>}
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
