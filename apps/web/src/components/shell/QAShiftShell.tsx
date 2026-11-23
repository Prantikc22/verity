"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { PROJECT_GROUPS, isActiveItem } from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";

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
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14 2h-4l-.8 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1L10 22h4l.8-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z",
};

export const WORKSPACE_NAV = [
  { href: "/dashboard", label: "Overview", icon: P.overview, also: [] as string[] },
  { href: "/dashboard/projects", label: "Projects", icon: P.projects, also: [] },
  { href: "/dashboard/runs", label: "Test Runs", icon: P.runs, also: [] },
  { href: "/dashboard/agents", label: "Agents", icon: P.agents, also: [] },
  { href: "/dashboard/coverage", label: "Coverage", icon: P.coverage, also: [] },
  { href: "/dashboard/reports", label: "Reports", icon: P.reports, also: ["/dashboard/trends"] },
  { href: "/dashboard/integrations", label: "Integrations", icon: P.integrations, also: ["/dashboard/github"] },
  { href: "/dashboard/usage", label: "Usage & Billing", icon: P.billing, also: [] },
  { href: "/dashboard/settings", label: "Settings", icon: P.settings, also: ["/dashboard/team"] },
];

function Icon({ d }: { d: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Mark() {
  return (
    <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M 43.56 21.1 A 19 19 0 1 0 42.56 44.21" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M 19 33 L 27 41 L 55 13" fill="none" stroke="#22C55E" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QAShiftShell({ org, plan, email, children }: { org: string; plan: string; email: string; children: React.ReactNode }) {
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

  const isActive = (n: (typeof WORKSPACE_NAV)[number]) =>
    n.href === "/dashboard" ? pathname === "/dashboard"
      : n.href === "/dashboard/projects" ? pathname.startsWith("/dashboard/projects")
      : pathname === n.href || pathname.startsWith(`${n.href}/`) || n.also.some((a) => pathname.startsWith(a));

  const link = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`;

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0A0D18] text-slate-200">
      <div className="flex items-center gap-2 px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2 text-white"><Mark /><span className="text-[17px] font-semibold tracking-tight">QAShift</span></Link>
      </div>
      <div className="mx-3 mb-3 rounded-xl border border-white/10 px-3 py-2.5">
        <div className="truncate text-[13px] font-medium text-white">{org}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-slate-400">{plan}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <nav aria-label="Workspace" className="space-y-0.5">
          {WORKSPACE_NAV.map((n) => {
            const active = isActive(n);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={link(active)}>
                <Icon d={n.icon} />{n.label}
              </Link>
            );
          })}
        </nav>

        {projectId && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="px-3 pb-2 text-[11px] font-medium text-slate-500">Project</div>
            <div className="truncate px-3 pb-2 text-[13.5px] font-semibold text-white" title={projectName ?? undefined}>{projectName ?? "Project"}</div>
            {PROJECT_GROUPS.map((group, gi) => (
              <nav key={gi} className={`space-y-0.5 ${gi ? "mt-3" : ""}`} aria-label={group.heading ?? "Project"}>
                {group.heading && <div className="px-3 pb-1 text-[11px] font-medium text-slate-500">{group.heading}</div>}
                {group.items.map((n) => {
                  const href = `/dashboard/projects/${projectId}${n.seg ? `/${n.seg}` : ""}`;
                  const active = isActiveItem(pathname, projectId, n);
                  return (
                    <Link key={n.seg || "overview"} href={href} aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition ${active ? "bg-[#6A4BFF] text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                      <Icon d={n.icon} />{n.label}
                    </Link>
                  );
                })}
              </nav>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="truncate text-[12px] text-slate-400">{email}</div>
        <div className="mt-3 flex items-center gap-2">
          <Link href="/docs" className="flex-1 rounded-lg border border-white/15 px-2 py-1.5 text-center text-xs text-slate-300 hover:text-white">Docs</Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FAF9F5] text-[#0A0D18] dark:bg-neutral-950 dark:text-neutral-100">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between bg-[#0A0D18] px-4 py-3 text-white lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2"><Mark /><span className="font-semibold">QAShift</span></Link>
          <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-white/20 p-2" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={open ? "M6 6l12 12M18 6L6 18" : "M3 6h18M3 12h18M3 18h18"} /></svg>
          </button>
        </div>
        {open && <div className="lg:hidden">{sidebar}</div>}
        <main id="main" className="flex-1 px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
