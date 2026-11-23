import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AGENTS, ACCESSIBILITY_APP_URL } from "@/lib/catalog";
import { entitlementsFor } from "@/lib/entitlements";
import { Card, PageHeader, StatusPill, timeAgo, daysAgoISO } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Agents", robots: { index: false } };

export default async function AgentsPage() {
  const orgCtx = await getPrimaryOrg();
  const ent = entitlementsFor(orgCtx?.org);
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();

  const since = daysAgoISO(30);
  const [{ data: runs }, { data: firstProject }] = orgId
    ? await Promise.all([
        supabase.from("test_runs").select("discipline, created_at").eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
        supabase.from("projects").select("id").eq("org_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  const stats = new Map<string, { count: number; last: string | null }>();
  for (const r of runs ?? []) {
    const s = stats.get(r.discipline) ?? { count: 0, last: null };
    s.count += 1; s.last ??= r.created_at;
    stats.set(r.discipline, s);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Agents" lead={<>All six agents are included in your plan ({ent.label}). Credits are pooled across agents: {ent.creditsPerMonth.toLocaleString()} a month. Runs in your own CI don&apos;t use credits.</>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a) => {
          const agg = a.disciplines.map((d) => stats.get(d)).filter(Boolean) as { count: number; last: string | null }[];
          const count = agg.reduce((n, s) => n + s.count, 0);
          const last = agg.map((s) => s.last).filter(Boolean).sort().pop() ?? null;
          const included = ent.agents.includes(a.key);
          const start = a.key === "accessibility" ? ACCESSIBILITY_APP_URL : firstProject && a.projectPath ? `/dashboard/projects/${firstProject.id}/${a.projectPath}` : "/dashboard/projects";
          return (
            <Card key={a.key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold tracking-tight">{a.name}</h2>
                <StatusPill status={a.status} />
              </div>
              <p className="text-sm text-neutral-500">{a.summary}</p>
              <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-[#E6E2D6] pt-3 text-xs dark:border-neutral-800">
                <div><dt className="text-neutral-500">Runs, last 30 days</dt><dd className="tnum mt-0.5 text-sm font-medium">{a.key === "accessibility" ? "On Clearpath" : count}</dd></div>
                <div><dt className="text-neutral-500">Last run</dt><dd className="mt-0.5 text-sm font-medium">{a.key === "accessibility" ? "—" : last ? timeAgo(last) : "Never"}</dd></div>
              </dl>
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-neutral-500">{included ? "Included in your plan" : "Not on this plan"}</span>
                {a.key === "accessibility"
                  ? <a href={start} className="font-medium text-[#5534F2] hover:underline">Open ↗</a>
                  : <Link href={start} className="font-medium text-[#5534F2] hover:underline">{count ? "Open" : "Set up"} →</Link>}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 bg-[#0A0D18] text-slate-300 dark:bg-[#0A0D18]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-white"><span className="font-semibold">Failure Investigator</span><StatusPill status="live" /></div>
            <p className="mt-1.5 text-sm">Classifies every failure across agents as a real failure or flaky, using automatic re-runs. Suggested test fixes (self-healing) are <span className="text-amber-300">beta</span>, shown as diffs, and never merged automatically.</p>
          </div>
        </div>
      </Card>

      <p className="mt-6 text-xs text-neutral-500">The Accessibility Agent still runs on the Clearpath engine with its own sign-in. It moves into this workspace when Clearpath accounts are imported.</p>
    </div>
  );
}
