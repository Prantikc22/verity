import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Panel } from "@/components/shell/ui";
import { RunsTable, RUN_COLUMNS, type RunRow } from "@/components/shell/RunsTable";
import { RunFilters } from "@/components/shell/RunFilters";
import { applyRunFilters } from "@/lib/runs-filter";

export const metadata: Metadata = { title: "Test Runs", robots: { index: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function RunsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();
  const filtered = Object.keys(sp).some((k) => ["result", "source", "agent", "range", "project", "q"].includes(k) && sp[k]);

  const [{ data: runs }, { data: projects }, { count: everCount }] = orgId
    ? await Promise.all([
        applyRunFilters(supabase.from("test_runs").select(RUN_COLUMNS).eq("org_id", orgId), sp).order("created_at", { ascending: false }).limit(200),
        supabase.from("projects").select("id, name").eq("org_id", orgId).order("name"),
        supabase.from("test_runs").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      ])
    : [{ data: [] }, { data: [] }, { count: 0 }];

  return (
    <>
      <PageHeader title="Test Runs" lead="Every run across your projects and agents, from CI, cloud runs and your laptop. Filter, then open a run for failures, attempts and history." />
      {!everCount ? (
        <Empty title="No runs yet" body="Runs appear here as soon as your tests report in, from CI, your laptop or a cloud run. Connecting takes about two minutes." href="/dashboard/reports" cta="Connect my tests" />
      ) : (
        <Panel flush>
          <RunFilters total={runs?.length ?? 0} projects={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))} />
          {runs && runs.length > 0
            ? <RunsTable runs={runs as RunRow[]} projectNames={new Map((projects ?? []).map((p) => [p.id, p.name]))} />
            : <p className="p-6 text-center text-[13px] text-neutral-500">{filtered ? "No runs match these filters." : "No runs yet."}</p>}
        </Panel>
      )}
    </>
  );
}
