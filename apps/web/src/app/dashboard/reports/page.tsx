import Link from "next/link";
import { projectTokens } from "@/lib/tokens";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { entitlementsFor } from "@/lib/entitlements";
import { buildReport } from "@/lib/reports/build";
import { ReportView } from "@/components/reports/ReportView";
import { ReporterSetup } from "@/components/shell/ReporterSetup";
import { ShareReport } from "@/components/reports/ShareReport";
import { PageHeader, Panel } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

const RANGES = [7, 14, 30] as const;
const API_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qashifthq.com";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ project?: string; days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days) as (typeof RANGES)[number]) ? Number(sp.days) : 14;
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const ent = entitlementsFor(orgCtx?.org);
  const supabase = await createClient();

  const { data: projects } = orgId ? await supabase.from("projects").select("id, name").eq("org_id", orgId).order("name") : { data: [] };
  const projectIds = (projects ?? []).map((p) => p.id).filter((id) => !sp.project || id === sp.project);
  const pName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const data = await buildReport(supabase, projectIds, pName, days);
  const tokenRows = await Promise.all((projects ?? []).filter((p) => !sp.project || p.id === sp.project).slice(0, 20).map(async (p) => ({ id: p.id, name: p.name, token: (await projectTokens(supabase, p.id)).ingest })));
  const tokens = tokenRows.filter((p): p is { id: string; name: string; token: string } => !!p.token);
  const historyDays = ent.reports?.historyDays ?? ent.maxRunHistory;

  const q = (o: { project?: string; days?: number }) => {
    const u = new URLSearchParams();
    const pr = o.project === undefined ? sp.project : o.project;
    if (pr) u.set("project", pr);
    u.set("days", String(o.days ?? days));
    return `/dashboard/reports?${u}`;
  };

  return (
    <>
      <PageHeader title="Reports" lead={<>Test health across runs. Your plan keeps run detail for {historyDays > 9999 ? "unlimited" : historyDays} days; aggregate trends are kept for the life of the project.</>}
        action={data.runs > 0 ? <ShareReport project={sp.project ?? null} days={days} /> : undefined} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
          {RANGES.map((d) => (
            <Link key={d} href={q({ days: d })} aria-current={d === days ? "true" : undefined} className={`rounded px-2.5 py-1 text-[12.5px] ${d === days ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}>{d}d</Link>
          ))}
        </div>
        <div className="inline-flex flex-wrap rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
          <Link href={q({ project: "" })} className={`rounded px-2.5 py-1 text-[12.5px] ${!sp.project ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white" : "text-neutral-600"}`}>All projects</Link>
          {(projects ?? []).map((p) => (
            <Link key={p.id} href={q({ project: p.id })} className={`rounded px-2.5 py-1 text-[12.5px] ${sp.project === p.id ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white" : "text-neutral-600"}`}>{p.name}</Link>
          ))}
        </div>
      </div>

      {data.runs === 0 ? (
        <div className="space-y-4">
          <ReporterSetup apiUrl={API_URL} projects={tokens} />
        </div>
      ) : (
        <ReportView data={data} days={days}
          usage={ent.reports ? <p className="mt-2 text-[12px] text-neutral-500">Reports plan: {data.total.toLocaleString()} of {ent.reports.resultsPerMonth.toLocaleString()} monthly results used in this window.</p> : null}
          extraPanel={<Panel title="Connect more suites"><ReporterSetup apiUrl={API_URL} compact projects={tokens} /></Panel>} />
      )}
    </>
  );
}
