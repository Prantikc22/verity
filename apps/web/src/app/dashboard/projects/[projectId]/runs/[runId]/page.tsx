import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { explainPlaywrightError } from "@qashift/verity-core";
import { buildRunReport } from "@/lib/reports/run-report";
import { RunReport } from "@/components/report/RunReport";

export const metadata: Metadata = { title: "Run report", robots: { index: false } };

export default async function RunReportPage({ params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const { projectId, runId } = await params;
  const supabase = await createClient();
  const data = await buildRunReport(supabase, projectId, runId, explainPlaywrightError);
  if (!data) notFound();
  const label = data.run.pr ? `PR #${data.run.pr}` : data.run.branch === "cloud-trial" ? "Cloud check" : data.run.branch === "cloud" ? "Cloud run" : data.run.branch ?? "Run";

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/dashboard/projects/${projectId}/runs`} className="text-xs text-neutral-400 hover:text-neutral-600">← All runs</Link>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{label} <span className="font-normal text-neutral-400">· {data.run.tier === "fast" ? "Quick check" : "Full regression"}</span></h2>
      </div>
      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">No per-test results were recorded for this run. Security scans and performance checks show their findings on the project&apos;s Security and Performance pages.</p>
      ) : (
        <RunReport data={data} />
      )}
    </div>
  );
}
