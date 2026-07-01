import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { explainPlaywrightError } from "@qashift/verity-core";

export const metadata: Metadata = { title: "Run report", robots: { index: false } };

const tierLabel = (t: string) => (t === "fast" ? "Quick check" : "Full regression");

export default async function RunReportPage({ params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const { projectId, runId } = await params;
  const supabase = await createClient();

  const [{ data: run }, { data: results }, { data: heals }] = await Promise.all([
    supabase.from("test_runs").select("*").eq("id", runId).eq("project_id", projectId).maybeSingle(),
    supabase.from("test_results").select("id, status, error_message, duration_ms, attempts, test_id, name, spec_path").eq("run_id", runId),
    supabase.from("healing_events").select("test_id, new_selector").eq("run_id", runId).eq("status", "applied"),
  ]);
  if (!run) notFound();

  // Pull the test names + plans for the rows.
  const testIds = [...new Set((results ?? []).map((r) => r.test_id).filter(Boolean))] as string[];
  const { data: tests } = testIds.length
    ? await supabase.from("tests").select("id, name, spec_path, plan").in("id", testIds)
    : { data: [] };
  const testById = new Map((tests ?? []).map((t) => [t.id, t]));
  const healedBy = new Map((heals ?? []).map((h) => [h.test_id, h.new_selector]));

  const baseName = (p: string | null) => (p ? p.split("/").pop()!.replace(/\.spec\.(t|j)s$/, "").replace(/[-_]/g, " ") : "");
  const rows = (results ?? []).map((r) => {
    const t = r.test_id ? testById.get(r.test_id) : null;
    const healed = r.test_id ? healedBy.get(r.test_id) : null;
    // Prefer the linked Verity test's name; otherwise the result's own name /
    // spec path (CI runs legitimately include specs not authored in Verity).
    return {
      id: r.id,
      name: t?.name ?? r.name ?? (baseName(r.spec_path) || "Test"),
      spec_path: t?.spec_path ?? r.spec_path ?? "",
      plan: Array.isArray(t?.plan) ? (t!.plan as unknown[]).map(String) : [],
      status: r.status as string,
      durationMs: r.duration_ms ?? 0,
      error: r.error_message,
      explanation: r.status === "passed" ? null : explainPlaywrightError(r.error_message),
      healed: !!healed,
      healExplanation: healed ?? null,
    };
  });
  // Passed first? Keep failures visible at top.
  rows.sort((a, b) => (a.status === "failed" ? -1 : 1) - (b.status === "failed" ? -1 : 1));

  const color = (s: string) => s === "passed" ? "text-emerald-600" : s === "failed" ? "text-red-600" : s === "flaky" ? "text-amber-600" : "text-neutral-500";
  const dot = (s: string) => s === "passed" ? "bg-emerald-500" : s === "failed" ? "bg-red-500" : s === "flaky" ? "bg-amber-500" : "bg-neutral-400";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/projects/${projectId}/runs`} className="text-xs text-neutral-400 hover:text-neutral-600">← Runs &amp; healing</Link>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Run report</h2>
        <p className="text-xs text-neutral-500">
          <span className="font-medium">{tierLabel(run.tier)}</span> · {run.branch ?? "—"} · {run.commit_sha?.slice(0, 12) ?? "—"} · {new Date(run.created_at).toLocaleString()}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-neutral-500">{run.total} total</span>
        <span className="text-emerald-600">{run.passed} passed</span>
        <span className="text-red-600">{run.failed} failed</span>
        <span className="text-amber-600">{run.flaky} flaky</span>
        {heals && heals.length > 0 && <span className="text-violet-600">{heals.length} self-healed</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No per-test results were recorded for this run.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <details key={r.id} className="border border-neutral-200 dark:border-neutral-800">
              <summary className="flex cursor-pointer items-center gap-2 p-3">
                <span className={`h-2.5 w-2.5 rounded-full ${dot(r.status)}`} />
                <span className="text-sm font-medium">{r.name}</span>
                <span className={`ml-auto text-[11px] font-semibold ${color(r.status)}`}>{r.healed ? "passed · self-healed ✓" : r.status === "passed" ? "passed ✓" : r.status}</span>
                {r.durationMs > 0 && <span className="text-[11px] text-neutral-400">{r.durationMs} ms</span>}
              </summary>
              <div className="border-t border-neutral-100 px-3 py-2 dark:border-neutral-800">
                {r.healed && r.healExplanation && (
                  <p className="border-l-2 border-violet-500 pl-2 text-xs text-violet-700 dark:text-violet-300"><strong>Self-healed:</strong> {r.healExplanation}</p>
                )}
                {r.status === "failed" && r.explanation && (
                  <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-300"><strong className="text-red-600">Why it failed:</strong> {r.explanation}</p>
                )}
                {r.plan.length > 0 && (
                  <>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Steps</p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-neutral-600 dark:text-neutral-300">
                      {r.plan.map((s, j) => <li key={j}>{s}</li>)}
                    </ol>
                  </>
                )}
                {r.spec_path && <p className="mt-2 font-mono text-[10px] text-neutral-400">{r.spec_path}</p>}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
