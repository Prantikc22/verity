import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { testConfidence, flakeRate } from "@qashift/verity-core";
import { TestManager, type ManagedTest } from "../TestManager";
import { ExportTests } from "../ExportTests";
import { PushAll } from "../PushAll";
import { VerifyDrafts } from "../VerifyDrafts";

export const metadata: Metadata = { title: "Test Library", robots: { index: false } };

// API specs are HTTP request tests (no browser) — "active" means enabled, not
// browser-Verified. Everything else runs through the verify pipeline.
const VERIFIABLE_KINDS = new Set(["ui", "visual", "agent"]);

export default async function TestsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: tests }, { data: flake }] = await Promise.all([
    supabase.from("projects").select("repo").eq("id", projectId).maybeSingle(),
    // Every discipline, one library.
    supabase.from("tests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("flake_stats").select("*").eq("project_id", projectId),
  ]);
  const flakeByTest = new Map((flake ?? []).map((f) => [f.test_id, f]));
  const all = tests ?? [];

  const rows: ManagedTest[] = all.map((t) => {
    const fs = flakeByTest.get(t.id);
    const fr = fs ? flakeRate({ runsTotal: fs.runs_total, flakyTotal: fs.flaky_total }) : null;
    const assertions = (t.spec_content.match(/expect\s*\(/g) ?? []).length;
    // Confidence/flake only mean something for the run-through disciplines (ui/api).
    const scored = t.kind === "ui" || t.kind === "api";
    const conf = scored
      ? testConfidence({ criticalPath: t.critical_path, runsTotal: fs?.runs_total ?? 0, flakeRate: fr ?? 0, assertionCount: assertions })
      : null;
    return {
      id: t.id,
      name: t.name,
      spec_path: t.spec_path,
      suite: t.suite ?? null,
      status: t.status,
      kind: t.kind,
      verifiable: VERIFIABLE_KINDS.has(t.kind),
      critical_path: t.critical_path,
      is_pom: t.is_pom,
      confidence: conf,
      confidenceLabel: !scored ? "—" : conf === null ? "— not enough runs" : `${Math.round(conf * 100)}%`,
      flakePct: fr,
      flakeLabel: scored && fs ? `${Math.round((fr ?? 0) * 100)}% (${fs.runs_total} runs)` : "—",
      createdMs: t.created_at ? new Date(t.created_at).getTime() : 0,
      plan: Array.isArray(t.plan) ? (t.plan as unknown[]).map(String) : [],
      spec_content: t.spec_content,
    };
  });

  const draftCount = all.filter((t) => t.status === "draft" && VERIFIABLE_KINDS.has(t.kind)).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Test Library ({rows.length})</h2>
          <p className="text-xs text-neutral-500">Every test in this project — UI, API, visual and agent — in one place. Search, filter and sort; expand any test for its plan + code, or push it to GitHub.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link href={`/dashboard/projects/${projectId}/generate`} className="bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">＋ Generate</Link>
          <ExportTests projectId={projectId} />
          <PushAll projectId={projectId} repoLinked={Boolean(project?.repo)} />
        </div>
      </div>

      {draftCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-emerald-200 bg-emerald-50/40 px-4 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs text-neutral-600 dark:text-neutral-300"><strong>Verified generation:</strong> run drafts in a real browser and self-heal them — a <span className="text-emerald-600">Verified ✓</span> test has actually passed, not just been generated.</p>
          <VerifyDrafts projectId={projectId} draftCount={draftCount} />
        </div>
      )}

      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">No tests yet. <Link href={`/dashboard/projects/${projectId}/generate`} className="text-indigo-600 underline">Generate your first test →</Link></p>
        ) : (
          <TestManager projectId={projectId} repoLinked={Boolean(project?.repo)} rows={rows} />
        )}
      </div>
    </div>
  );
}
