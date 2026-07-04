import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { VisualGenerate } from "./VisualGenerate";
import { TestList } from "../TestList";
import { PushAll } from "../PushAll";

export const metadata: Metadata = { title: "Visual", robots: { index: false } };

const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  passed: { dot: "bg-emerald-500", text: "text-emerald-600", label: "Matched" },
  failed: { dot: "bg-red-600", text: "text-red-600", label: "Changed" },
  flaky: { dot: "bg-amber-500", text: "text-amber-600", label: "Flaky" },
  healed: { dot: "bg-indigo-500", text: "text-indigo-600", label: "Healed" },
  skipped: { dot: "bg-neutral-300", text: "text-neutral-400", label: "Skipped" },
};

export default async function VisualPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: latestRun }, { data: savedSpecs }, { data: project }] = await Promise.all([
    supabase
      .from("test_runs")
      .select("id, commit_sha, created_at")
      .eq("project_id", projectId)
      .eq("discipline", "visual")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tests")
      .select("*")
      .eq("project_id", projectId)
      .eq("kind", "visual")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("repo").eq("id", projectId).maybeSingle(),
  ]);

  const { data: results } = latestRun
    ? await supabase.from("test_results").select("*").eq("run_id", latestRun.id).eq("discipline", "visual")
    : { data: [] as never[] };

  const all = results ?? [];
  const changed = all.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Visual</h2>
          <p className="text-xs text-neutral-500">Pixel/screenshot regression — every PR is diffed against a committed baseline. A <strong>change</strong> means the UI shifted; you approve or reject the new baseline.</p>
        </div>
        <Link href={`/dashboard/projects/${projectId}/ci`} className="shrink-0 border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30">⚙️ Turn on Visual in CI →</Link>
      </div>

      <VisualGenerate projectId={projectId} />

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-neutral-500">Saved visual specs ({savedSpecs?.length ?? 0})</h3>
          <PushAll projectId={projectId} repoLinked={Boolean(project?.repo)} />
        </div>
        <TestList
          projectId={projectId}
          repoLinked={Boolean(project?.repo)}
          rows={(savedSpecs ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            spec_path: t.spec_path,
            suite: t.suite ?? null,
            status: t.status,
            critical_path: t.critical_path,
            is_pom: t.is_pom,
            confidenceLabel: "—",
            flakeLabel: "—",
            plan: Array.isArray(t.plan) ? (t.plan as unknown[]).map(String) : [],
            spec_content: t.spec_content,
          }))}
        />
      </section>

      <details className="border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">How visual testing works <span className="font-normal text-neutral-400">— screenshots, not selectors</span></summary>
        <div className="space-y-3 border-t border-neutral-200 p-5 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <p>Verity generates a Playwright test that navigates to a stable UI state, masks volatile regions (timestamps, avatars, ads), and captures a screenshot. On every run the screenshot is diffed against the baseline committed in your repo.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-emerald-600">Matched</strong> — within the pixel threshold. Nothing to do.</li>
            <li><strong className="text-red-600">Changed</strong> — the render differs. Intentional? Commit the new baseline. A real regression? Fix it.</li>
          </ul>
          <p>Because the snapshot lives in your repo and runs in your CI, coverage is unlimited — Verity authors and heals the specs; you own the pixels.</p>
        </div>
      </details>

      {!latestRun || all.length === 0 ? (
        <div className="border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">{latestRun ? "No visual snapshots in the latest run." : "No visual runs yet."}</p>
          <p className="mt-1 text-xs text-neutral-400">Generate a snapshot from the <Link href={`/dashboard/projects/${projectId}/generate`} className="text-indigo-600 underline">UI generator</Link>, then enable <strong>Visual</strong> in <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 underline">CI Setup</Link>.</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-neutral-400">Run {latestRun.commit_sha?.slice(0, 7)} · {new Date(latestRun.created_at).toLocaleString()} · {changed} changed of {all.length}</p>
          <section className="divide-y divide-neutral-100 border border-neutral-200 dark:divide-neutral-800/60 dark:border-neutral-800">
            {all.map((r) => {
              const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.skipped;
              return (
                <div key={r.id} className="flex items-start gap-3 p-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase ${st.text}`}>{st.label}</span>
                      <span className="text-sm font-medium">{r.name ?? r.spec_path}</span>
                    </div>
                    {r.spec_path && <code className="mt-0.5 block truncate text-[11px] text-neutral-500">{r.spec_path}</code>}
                    {r.error_message && <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{r.error_message}</p>}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
