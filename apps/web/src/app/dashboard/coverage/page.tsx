import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/catalog";
import { Card, Empty, PageHeader } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Coverage", robots: { index: false } };

/**
 * Coverage = what exists, per project and agent. We deliberately show counts
 * of maintained tests and critical paths, not a "% covered" number, because
 * we cannot measure true coverage of a customer's product.
 */
export default async function CoveragePage() {
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();

  const [{ data: projects }, { data: tests }] = orgId
    ? await Promise.all([
        supabase.from("projects").select("id, name").eq("org_id", orgId).order("created_at", { ascending: true }),
        supabase.from("tests").select("project_id, kind, status, critical_path").eq("org_id", orgId).neq("status", "archived").limit(5000),
      ])
    : [{ data: [] }, { data: [] }];

  const cols = AGENTS.filter((a) => a.key !== "accessibility" && a.key !== "security");
  const grid = new Map<string, Map<string, number>>();
  const critical = new Map<string, number>();
  for (const t of tests ?? []) {
    const row = grid.get(t.project_id) ?? new Map<string, number>();
    row.set(t.kind, (row.get(t.kind) ?? 0) + 1);
    grid.set(t.project_id, row);
    if (t.critical_path) critical.set(t.project_id, (critical.get(t.project_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Coverage" lead="Maintained tests per project and agent. We show what exists, not a coverage percentage we cannot measure." />
      {!projects || projects.length === 0 ? (
        <Empty title="No projects yet" body="Create a project and generate tests to see coverage here." href="/dashboard/projects" cta="Create a project" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-[#E6E2D6] text-left text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Project</th>
                {cols.map((a) => <th key={a.key} scope="col" className="px-4 py-3 font-medium">{a.name.replace(" Agent", "")}</th>)}
                <th scope="col" className="px-4 py-3 font-medium">Critical paths</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E2D6] dark:divide-neutral-800">
              {projects.map((p) => {
                const row = grid.get(p.id);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3"><Link href={`/dashboard/projects/${p.id}/tests`} className="font-medium hover:underline">{p.name}</Link></td>
                    {cols.map((a) => {
                      const n = a.disciplines.reduce((s, d) => s + (row?.get(d) ?? 0), 0);
                      return <td key={a.key} className={`tnum px-4 py-3 ${n ? "" : "text-neutral-400"}`}>{n || "—"}</td>;
                    })}
                    <td className="tnum px-4 py-3">{critical.get(p.id) ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {projects && projects.length > 0 && (tests ?? []).length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          No tests yet. <Link href={`/dashboard/projects/${projects[0].id}/create`} className="font-medium text-indigo-600 underline">Create your first tests</Link> and this table fills in by agent.
        </p>
      )}
      <p className="mt-4 text-xs text-neutral-500">Security findings and accessibility issues are results, not maintained tests, so they appear under each project&apos;s results and on the Agents page.</p>
    </div>
  );
}
