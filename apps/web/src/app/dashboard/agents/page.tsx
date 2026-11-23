import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/catalog";
import { entitlementsFor } from "@/lib/entitlements";
import { Chip, PageHeader, Panel, StatusPill, daysAgoISO, timeAgo, th, td } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Agents", robots: { index: false } };

export default async function AgentsPage() {
  const orgCtx = await getPrimaryOrg();
  const ent = entitlementsFor(orgCtx?.org);
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();
  const since = daysAgoISO(30);

  const [{ data: runs }, { data: scans }, { data: firstProject }] = orgId
    ? await Promise.all([
        supabase.from("test_runs").select("discipline, created_at, failed").eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
        supabase.from("a11y_scans").select("created_at, violations_count").eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
        supabase.from("projects").select("id").eq("org_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      ])
    : [{ data: [] }, { data: [] }, { data: null }];

  const stats = (key: string, disciplines: string[]) => {
    if (key === "accessibility") {
      const s = scans ?? [];
      return { count: s.length, last: s[0]?.created_at ?? null, failing: s.filter((x) => x.violations_count > 0).length };
    }
    const rs = (runs ?? []).filter((r) => disciplines.includes(r.discipline));
    return { count: rs.length, last: rs[0]?.created_at ?? null, failing: rs.filter((r) => r.failed > 0).length };
  };

  return (
    <>
      <PageHeader title="Agents" lead={<>All six agents are included in {ent.label}. Credits are pooled across agents ({ent.creditsPerMonth.toLocaleString()} a month); runs in your own CI don&apos;t use credits.</>} />
      <Panel flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="border-b border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900">
              <tr><th className={th}>Agent</th><th className={th}>Status</th><th className={`${th} text-right`}>Runs · 30d</th><th className={`${th} text-right`}>With failures</th><th className={`${th} text-right`}>Last run</th><th className={th}><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {AGENTS.map((a) => {
                const s = stats(a.key, a.disciplines);
                const href = firstProject && a.projectPath ? `/dashboard/projects/${firstProject.id}/${a.projectPath}` : "/dashboard/projects";
                return (
                  <tr key={a.key} className="hover:bg-neutral-50 dark:hover:bg-neutral-950">
                    <td className={td}><div className="font-medium">{a.codename} <span className="font-normal text-neutral-500">· {a.name}</span></div><div className="text-[12px] text-neutral-500">{a.summary}</div></td>
                    <td className={td}><StatusPill status={a.status} /></td>
                    <td className={`${td} tnum text-right`}>{s.count}</td>
                    <td className={`${td} tnum text-right ${s.failing ? "text-red-700" : "text-neutral-500"}`}>{s.failing}</td>
                    <td className={`${td} whitespace-nowrap text-right text-neutral-500`}>{s.last ? timeAgo(s.last) : "Never"}</td>
                    <td className={`${td} text-right`}><Link href={href} className="font-medium text-violet-700 hover:underline">{s.count ? "Open" : "Set up"} →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="mt-5" title={<span>Tracer <span className="font-normal text-neutral-500">· Failure Investigator</span></span>} action={<span className="flex gap-1.5"><Chip tone="ok">Classification live</Chip><Chip tone="warn">Fixes beta</Chip></span>}>
        <p className="text-[13px] text-neutral-600 dark:text-neutral-400">Every failure is re-run and classified as a real failure or flaky. Suggested test fixes appear as diffs on the run page and are never merged automatically.</p>
      </Panel>
    </>
  );
}
