import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HealingReview } from "../HealingReview";

export const metadata: Metadata = { title: "Runs & healing", robots: { index: false } };

export default async function RunsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: runs }, { data: healing }] = await Promise.all([
    supabase.from("test_runs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(25),
    supabase.from("healing_events").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(15),
  ]);

  const tierLabel = (t: string) => (t === "fast" ? "Quick check" : "Full regression");

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Recent runs</h2>
        {!runs || runs.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No runs yet. Wire the ingest token (Settings) into your CI to record runs.</p>
        ) : (
          <div className="mt-3 overflow-x-auto border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-neutral-200 text-left text-xs text-neutral-400 dark:border-neutral-800">
                <tr><th className="p-3">Tier</th><th className="p-3">Commit</th><th className="p-3">Passed</th><th className="p-3">Failed</th><th className="p-3">Flaky</th><th className="p-3">When</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                    <td className="p-3">
                      <span className={`border px-2 py-0.5 text-[11px] font-medium ${r.tier === "fast" ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300" : "border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"}`}>{tierLabel(r.tier)}</span>
                    </td>
                    <td className="p-3 font-mono text-xs text-neutral-500">{r.commit_sha?.slice(0, 7) ?? "—"}</td>
                    <td className="p-3 text-emerald-600">{r.passed}</td>
                    <td className="p-3 text-red-600">{r.failed}</td>
                    <td className="p-3 text-amber-600">{r.flaky}</td>
                    <td className="p-3 text-xs text-neutral-400">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-3 text-xs"><Link href={`/dashboard/projects/${projectId}/runs/${r.id}`} className="text-indigo-600 hover:underline">Open report →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
