import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import { IngestToken } from "../IngestToken";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://verity-kappa-ebon.vercel.app";
const RETAINED_RUNS = 30;

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("ingest_token, repo, default_branch, rerun_count, regression_threshold, org_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();
  const { data: org } = await supabase.from("orgs").select("plan").eq("id", project.org_id).maybeSingle();
  const plan = planFor(org?.plan);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Project settings</h2>
        <p className="text-xs text-neutral-500">
          Configuration for this project — branch, flake reruns, thresholds, data retention, and your token.
          To <strong>wire your pipeline</strong> (pick tests + get GitHub/GitLab/Jenkins config), use{" "}
          <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 underline">CI Setup</Link> instead.
        </p>
      </div>

      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">CI ingest token</h3>
          <Link href={`/dashboard/projects/${projectId}/ci`} className="text-xs text-indigo-600 hover:underline">Set up CI →</Link>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Store as <code>VERITY_INGEST_TOKEN</code> in your CI secrets. It links runs to this project. Full setup instructions live in CI Setup.</p>
        <div className="mt-3"><IngestToken token={project.ingest_token} /></div>
        <p className="mt-3 text-[11px] text-neutral-500">Ingest endpoint: <code>{APP}/api/ingest</code></p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs text-neutral-500">Repo</div>
          <div className="mt-1 font-medium">{project.repo ?? "—"}</div>
        </div>
        <div className="border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs text-neutral-500">Default branch</div>
          <div className="mt-1 font-medium">{project.default_branch}</div>
        </div>
        <div className="border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs text-neutral-500">Flake reruns (N)</div>
          <div className="mt-1 font-medium">×{project.rerun_count}</div>
        </div>
        <div className="border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs text-neutral-500">Regression flag threshold</div>
          <div className="mt-1 font-medium">{Math.round(Number(project.regression_threshold) * 100)}%</div>
        </div>
      </section>

      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <h3 className="text-sm font-medium">Data retention</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Verity keeps the <strong>last {RETAINED_RUNS} runs</strong> of detailed history per project — older run records are pruned automatically (you&apos;re on the {plan.name} plan). Your <strong>aggregate trends and predictions are preserved</strong>: flake rates, regression-prone files, and deploy confidence are rolled up into compact stats that don&apos;t expire, so the intelligence keeps improving even as old raw runs age out.
        </p>
      </section>
    </div>
  );
}
