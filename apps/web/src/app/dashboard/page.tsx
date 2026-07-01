import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectTrend } from "./projects/[projectId]/ProjectTrend";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const orgCtx = await getPrimaryOrg();
  const supabase = await createClient();
  const plan = planFor(orgCtx?.org.plan);
  const orgId = orgCtx?.org.id;

  // Scope to the signed-in user's org — otherwise public projects (e.g. the
  // Verity Demo) leak into every account's dashboard and inflate the count.
  const { data: projects } = orgId
    ? await supabase
        .from("projects")
        .select("id, name, repo, default_branch, visibility")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const projectCount = projects?.length ?? 0;

  const [{ count: runCount }, { count: testCount }, { data: recent }] = orgId
    ? await Promise.all([
        supabase.from("test_runs").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("tests").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("test_runs").select("total, passed, flaky, created_at").eq("org_id", orgId).eq("status", "completed").order("created_at", { ascending: true }).limit(40),
      ])
    : [{ count: 0 }, { count: 0 }, { data: [] }];

  const r = recent ?? [];
  const latest = r[r.length - 1];
  const passRate = latest && latest.total ? Math.round((latest.passed / latest.total) * 100) : null;

  const stat = (v: string, k: string) => (
    <div className="v-card border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="tnum text-2xl font-semibold">{v}</div>
      <div className="mt-1 text-xs text-neutral-500">{k}</div>
    </div>
  );
  const cap = (n: number) => (n > 9999 ? "∞" : `${n}`);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <Link href="/dashboard/trends" className="border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">Per-project trends →</Link>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stat(`${projectCount}/${cap(plan.maxProjects)}`, "projects")}
        {stat(`${testCount ?? 0}`, "tests")}
        {stat(`${runCount ?? 0}`, "CI runs")}
        {stat(passRate === null ? "—" : `${passRate}%`, "latest pass rate")}
      </section>

      {/* Aggregate trend across the org */}
      {r.length >= 2 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-neutral-500">Across all projects (last {r.length} runs)</h2>
          <ProjectTrend
            pass={r.map((x) => (x.total ? x.passed / x.total : 0))}
            flake={r.map((x) => (x.total ? x.flaky / x.total : 0))}
            volume={r.map((x) => x.total)}
          />
        </section>
      )}

      <section className="mt-8">
        <CreateProjectForm />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-500">Projects</h2>
        {!projects || projects.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No projects yet. Create one above to get your ingest token and start generating tests.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/projects/${p.id}`} className="flex items-center justify-between py-4 hover:opacity-80">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-neutral-400">{p.repo ?? "no repo linked"} · {p.default_branch}</div>
                  </div>
                  <span className="text-xs text-neutral-400">{p.visibility}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
