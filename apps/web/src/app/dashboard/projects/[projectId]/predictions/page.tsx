import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryOrg } from "@/lib/auth";
import { planFor } from "@/lib/plans";
import { getCorrelation, getDeployConfidence } from "@/lib/predictions";

export const metadata: Metadata = { title: "Predictions", robots: { index: false } };

function Badge({ kind }: { kind: "live" | "calibrating" }) {
  const live = kind === "live";
  return (
    <span className={`ml-2 inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${live ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"}`}>
      <span className={`h-1.5 w-1.5 ${live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} /> {live ? "Live" : "Calibrating"}
    </span>
  );
}

export default async function PredictionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const orgCtx = await getPrimaryOrg();
  const plan = planFor(orgCtx?.org.plan);

  const [{ data: regress }, { data: flake }, { data: tests }] = await Promise.all([
    supabase.from("regression_stats").select("*").eq("project_id", projectId).order("regressions_total", { ascending: false }).limit(8),
    supabase.from("flake_stats").select("*").eq("project_id", projectId),
    supabase.from("tests").select("id, name").eq("project_id", projectId),
  ]);

  const correlation = plan.predictionsBeta ? await getCorrelation(projectId) : null;
  const confidence = plan.predictionsBeta ? await getDeployConfidence(projectId) : null;

  // Plain-English summary a PO/CTO can act on — project-scoped.
  const flakeSorted = [...(flake ?? [])].sort((a, b) => (b.flaky_total / Math.max(1, b.runs_total)) - (a.flaky_total / Math.max(1, a.runs_total)));
  const flakiest = flakeSorted[0];
  const flakiestPct = flakiest ? Math.round((flakiest.flaky_total / Math.max(1, flakiest.runs_total)) * 100) : 0;
  const flakyCount = flakeSorted.filter((f) => f.flaky_total > 0).length;
  const riskiest = regress?.[0];
  const riskiestPct = riskiest && riskiest.changes_total > 0 ? Math.round((riskiest.regressions_total / riskiest.changes_total) * 100) : 0;
  const score = confidence?.result.score ?? null;
  const sentences: string[] = [];
  if (riskiest && riskiestPct > 0) sentences.push(`Changes to **${riskiest.file_path}** are the most likely to break this app — it preceded a failure **${riskiestPct}%** of the times it was touched. Review PRs to it closely.`);
  if (flakiest && flakiestPct > 0) sentences.push(`Your least reliable test is **${tests?.find((t) => t.id === flakiest.test_id)?.name ?? "a test"}** (flaky **${flakiestPct}%** of runs)${flakyCount > 1 ? `, and ${flakyCount} tests show some flakiness` : ""} — flaky tests are auto-detected so they don't block merges.`);
  if (score != null) sentences.push(`Pre-merge deploy confidence is **${score}/100** — ${score >= 75 ? "safe to ship" : score >= 50 ? "ship with review" : "high risk, investigate before shipping"}.`);
  if (sentences.length === 0) sentences.push("Not enough run history yet to predict risk. Run your tests a few times (cloud or CI) and these turn into plain-English guidance here.");

  return (
    <div className="space-y-8">
      {/* Plain-English, project-scoped headline — the selling point */}
      <section className="border-l-4 border-indigo-500 bg-indigo-50/40 p-5 dark:bg-indigo-950/20">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">What Verity predicts for this project</h2>
          <Badge kind="live" />
        </div>
        <p className="mt-1 text-xs text-neutral-500">Predictions are <strong>per project</strong> — one project is one app/domain you&apos;re testing. They&apos;re built from this project&apos;s real run history.</p>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
          {sentences.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-indigo-500">→</span>
              <span dangerouslySetInnerHTML={{ __html: s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
            </li>
          ))}
        </ul>
        <Link href={`/dashboard/projects/${projectId}/runs`} className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">See the runs behind these →</Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">The detail <Badge kind="live" /></h2>
        {!plan.predictionsGA ? (
          <p className="mt-3 text-sm text-neutral-500">Predictions are available on Starter and up. <Link href="/pricing" className="text-indigo-600 underline">Upgrade</Link>.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-sm font-medium">Regression-prone files</h3>
              {!regress || regress.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-500">No history yet. As changed files flow through CI runs, the files that most often precede real failures appear here.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {regress.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <code className="text-neutral-600 dark:text-neutral-300">{r.file_path}</code>
                      <span className="text-neutral-500">{r.changes_total > 0 ? `${Math.round((r.regressions_total / r.changes_total) * 100)}%` : "—"} ({r.regressions_total}/{r.changes_total})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-sm font-medium">Flakiest tests</h3>
              {!flake || flake.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-500">No flake data yet. After a few runs, per-test flake rates appear here and inline in your PRs.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {[...flake].sort((a, b) => (b.flaky_total / Math.max(1, b.runs_total)) - (a.flaky_total / Math.max(1, a.runs_total))).slice(0, 6).map((f) => (
                    <li key={f.test_id} className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-300">{tests?.find((t) => t.id === f.test_id)?.name ?? "test"}</span>
                      <span className="text-neutral-500">{Math.round((f.flaky_total / Math.max(1, f.runs_total)) * 100)}% ({f.runs_total} runs)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {plan.predictionsBeta && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Predictions <Badge kind="calibrating" /></h2>
          <p className="mt-1 text-xs text-neutral-500">These grow more reliable as data accumulates and stay hidden until there&apos;s enough history. Not a guarantee.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-sm font-medium">Pre-merge deploy confidence</h3>
              {confidence?.result.score == null ? (
                <p className="mt-2 text-xs text-neutral-500">{confidence?.result.reason ?? "Not enough data yet."}</p>
              ) : (
                <>
                  <div className="mt-2 text-3xl font-semibold">{confidence.result.score}<span className="text-sm text-neutral-400">/100</span></div>
                  <ul className="mt-2 space-y-1 text-xs text-neutral-500">
                    {Object.entries(confidence.result.breakdown).map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span>{k.replace(/_/g, " ")}</span><span>{v == null ? "—" : `${Math.round(v * 100)}%`}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-sm font-medium">Cross-dimension risk correlation</h3>
              {!correlation?.available ? (
                <p className="mt-2 text-xs text-neutral-500">{correlation?.reason ?? "Not enough data yet."}</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-neutral-500">
                  <li className="flex justify-between"><span>regression risk ↔ failures</span><span>{correlation.regressionVsFailure == null ? "—" : correlation.regressionVsFailure.toFixed(2)}</span></li>
                  <li className="flex justify-between"><span>flake rate ↔ failures</span><span>{correlation.flakeVsFailure == null ? "—" : correlation.flakeVsFailure.toFixed(2)}</span></li>
                  <li className="pt-1 text-neutral-400">over {correlation.deploys} deploys</li>
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
