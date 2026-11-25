import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HealingReview } from "../HealingReview";
import { RunsTable, type RunRow } from "@/components/shell/RunsTable";
import { RunFilters } from "@/components/shell/RunFilters";
import { applyRunFilters } from "@/lib/runs-filter";

export const metadata: Metadata = { title: "Runs & healing", robots: { index: false } };

export default async function RunsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: runs }, { data: healing }] = await Promise.all([
    applyRunFilters(supabase.from("test_runs").select("*").eq("project_id", projectId), sp).order("created_at", { ascending: false }).limit(100),
    supabase.from("healing_events").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(15),
  ]);


  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Recent runs</h2>
        {(!runs || runs.length === 0) && !Object.values(sp).some(Boolean) ? (
          <p className="mt-3 text-sm text-neutral-500">No runs yet. <Link href={`/dashboard/projects/${projectId}/ci`} className="font-medium text-indigo-600 hover:underline">Connect your CI</Link> and every run shows up here.</p>
        ) : (
          <div className="mt-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <RunFilters total={runs?.length ?? 0} showProject={false} />
            {runs && runs.length > 0 ? <RunsTable runs={runs as RunRow[]} showProject={false} /> : <p className="p-6 text-center text-[13px] text-neutral-500">No runs match these filters.</p>}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Self-healing suggestions</h2>
        <HealingReview projectId={projectId} events={(healing ?? []).map((h) => ({
          id: h.id, old_selector: h.old_selector, new_selector: h.new_selector,
          confidence: h.confidence, status: h.status, created_at: h.created_at,
        }))} />
      </section>
    </div>
  );
}
