import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HealingReview } from "../HealingReview";
import { RunsTable, type RunRow } from "@/components/shell/RunsTable";

export const metadata: Metadata = { title: "Runs & healing", robots: { index: false } };

export default async function RunsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: runs }, { data: healing }] = await Promise.all([
    supabase.from("test_runs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(25),
    supabase.from("healing_events").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(15),
  ]);


  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Recent runs</h2>
        {!runs || runs.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No runs yet. <Link href={`/dashboard/projects/${projectId}/ci`} className="font-medium text-indigo-600 hover:underline">Connect your CI</Link> and every run shows up here.</p>
        ) : (
          <div className="mt-3 rounded-xl border border-neutral-200 dark:border-neutral-800"><RunsTable runs={runs as RunRow[]} showProject={false} /></div>
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
