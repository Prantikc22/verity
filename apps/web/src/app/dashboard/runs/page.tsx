import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Empty, PageHeader, timeAgo } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Test Runs", robots: { index: false } };

const TIER: Record<string, string> = { fast: "Quick check", full: "Full regression" };

export default async function RunsPage() {
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();

  const [{ data: runs }, { data: projects }] = orgId
    ? await Promise.all([
        supabase.from("test_runs").select("id, project_id, discipline, tier, trigger, branch, pr_number, status, total, passed, failed, flaky, duration_ms, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50),
        supabase.from("projects").select("id, name").eq("org_id", orgId),
      ])
    : [{ data: [] }, { data: [] }];

  const name = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Test Runs" lead="The latest 50 runs across every project and agent. Open a run for traces, failures and flaky-test details." />
      {!runs || runs.length === 0 ? (
        <Empty title="No runs yet" body="Runs appear here once a project posts results from CI, the CLI, or a cloud run." href="/dashboard/projects" cta="Go to projects" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-[#E6E2D6] text-left text-xs text-neutral-500 dark:border-neutral-800">
              <tr>{["Project", "Agent", "Tier", "Source", "Result", "Duration", "When"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#E6E2D6] dark:divide-neutral-800">
              {runs.map((r) => {
                const tone = r.status !== "completed" ? "text-neutral-500" : r.failed > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400";
                return (
                  <tr key={r.id} className="hover:bg-[#FAF9F5] dark:hover:bg-neutral-950">
                    <td className="px-4 py-3"><Link href={`/dashboard/projects/${r.project_id}/runs/${r.id}`} className="font-medium hover:underline">{name.get(r.project_id) ?? "Project"}</Link></td>
                    <td className="px-4 py-3 capitalize">{r.discipline}</td>
                    <td className="px-4 py-3">{TIER[r.tier] ?? r.tier}</td>
                    <td className="px-4 py-3 text-neutral-500">{r.pr_number ? `PR #${r.pr_number}` : r.branch ?? r.trigger}</td>
                    <td className={`tnum px-4 py-3 ${tone}`}>{r.status !== "completed" ? r.status : `${r.passed}/${r.total} passed${r.flaky ? ` · ${r.flaky} flaky` : ""}`}</td>
                    <td className="tnum px-4 py-3 text-neutral-500">{r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : "—"}</td>
                    <td className="px-4 py-3 text-neutral-500">{timeAgo(r.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
