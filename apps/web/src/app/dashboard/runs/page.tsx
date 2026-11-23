import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Panel } from "@/components/shell/ui";
import { RunsTable, RUN_COLUMNS, type RunRow } from "@/components/shell/RunsTable";

export const metadata: Metadata = { title: "Test Runs", robots: { index: false } };

export default async function RunsPage() {
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();

  const [{ data: runs }, { data: projects }] = orgId
    ? await Promise.all([
        supabase.from("test_runs").select(RUN_COLUMNS).eq("org_id", orgId).order("created_at", { ascending: false }).limit(100),
        supabase.from("projects").select("id, name").eq("org_id", orgId),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <>
      <PageHeader title="Test Runs" lead="The latest 100 runs across every project and agent. Open a run for failures, traces and flaky-test detail." />
      {!runs || runs.length === 0 ? (
        <Empty title="No runs yet" body="Runs appear here as soon as your tests report in, from CI, your laptop or a cloud run. Connecting takes about two minutes." href="/dashboard/reports" cta="Connect my tests" />
      ) : (
        <Panel flush><RunsTable runs={runs as RunRow[]} projectNames={new Map((projects ?? []).map((p) => [p.id, p.name]))} /></Panel>
      )}
    </>
  );
}
