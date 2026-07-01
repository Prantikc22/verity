import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { testConfidence, flakeRate } from "@qashift/verity-core";
import { TestList } from "../TestList";
import { ExportTests } from "../ExportTests";
import { PushAll } from "../PushAll";

export const metadata: Metadata = { title: "Tests", robots: { index: false } };

export default async function TestsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: tests }, { data: flake }] = await Promise.all([
    supabase.from("projects").select("repo").eq("id", projectId).maybeSingle(),
    supabase.from("tests").select("*").eq("project_id", projectId).eq("kind", "ui").order("created_at", { ascending: false }),
    supabase.from("flake_stats").select("*").eq("project_id", projectId),
  ]);
  const flakeByTest = new Map((flake ?? []).map((f) => [f.test_id, f]));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">UI tests ({tests?.length ?? 0})</h2>
          <p className="text-xs text-neutral-500">Saved Playwright <strong>UI</strong> specs (browser flows). API tests live under the API section. Expand any test to see its plan + code, or push it to GitHub.</p>
        </div>
        <div className="flex items-start gap-2">
          <Link href={`/dashboard/projects/${projectId}/generate`} className="bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">＋ Generate</Link>
          <ExportTests projectId={projectId} />
          <PushAll projectId={projectId} repoLinked={Boolean(project?.repo)} />
        </div>
      </div>

      <TestList
        projectId={projectId}
        repoLinked={Boolean(project?.repo)}
        rows={(tests ?? []).map((t) => {
          const fs = flakeByTest.get(t.id);
          const fr = fs ? flakeRate({ runsTotal: fs.runs_total, flakyTotal: fs.flaky_total }) : 0;
          const assertions = (t.spec_content.match(/expect\s*\(/g) ?? []).length;
          const conf = testConfidence({ criticalPath: t.critical_path, runsTotal: fs?.runs_total ?? 0, flakeRate: fr, assertionCount: assertions });
          return {
            id: t.id,
            name: t.name,
            spec_path: t.spec_path,
            suite: t.suite ?? null,
            status: t.status,
            critical_path: t.critical_path,
            is_pom: t.is_pom,
            confidenceLabel: conf === null ? "— not enough runs" : `${Math.round(conf * 100)}%`,
            flakeLabel: fs ? `${Math.round(fr * 100)}% (${fs.runs_total} runs)` : "—",
            plan: Array.isArray(t.plan) ? (t.plan as string[]) : [],
            spec_content: t.spec_content,
          };
        })}
      />
    </div>
  );
}
