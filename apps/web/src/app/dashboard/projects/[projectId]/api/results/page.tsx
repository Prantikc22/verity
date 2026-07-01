import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { groupApiResults, type UnifiedResult } from "@qashift/verity-core";

export const metadata: Metadata = { title: "API · Coverage & results", robots: { index: false } };

function attemptsFromStatus(status: string): boolean[] {
  switch (status) {
    case "passed": case "healed": return [true];
    case "failed": return [false];
    case "flaky": return [true, false];
    default: return [true];
  }
}

// The customer cares about API health per endpoint — NOT which engine ran. We
// lead with the endpoint and its result, and show *how* it was checked only as
// a small, secondary tag.
const METHOD_TAG: Record<string, { label: string; title: string; cls: string }> = {
  flow: { label: "journey", title: "Checked by an example-based user journey", cls: "text-neutral-400" },
  contract: { label: "contract", title: "Checked by automatic contract/property testing", cls: "text-neutral-400" },
};

export default async function ApiResultsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("test_runs")
    .select("commit_sha, created_at")
    .eq("project_id", projectId)
    .eq("discipline", "api")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let grouped: ReturnType<typeof groupApiResults> = [];
  if (latest?.commit_sha) {
    const { data: runs } = await supabase
      .from("test_runs").select("id").eq("project_id", projectId).eq("discipline", "api").eq("commit_sha", latest.commit_sha);
    const runIds = (runs ?? []).map((r) => r.id);
    const [{ data: rows }, { data: tests }] = await Promise.all([
      supabase.from("test_results").select("status, error_message, endpoint, layer, meaning, test_id").in("run_id", runIds.length ? runIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("tests").select("id, name").eq("project_id", projectId),
    ]);
    const nameById = new Map((tests ?? []).map((t) => [t.id, t.name]));
    const unified: UnifiedResult[] = (rows ?? []).map((r) => ({
      spec_path: r.endpoint ?? r.test_id ?? "endpoint",
      name: (r.test_id ? nameById.get(r.test_id) : null) ?? r.endpoint ?? "API check",
      attempts: attemptsFromStatus(r.status),
      discipline: "api",
      layer: (r.layer as "flow" | "contract" | null) ?? "flow",
      endpoint: r.endpoint,
      meaning: r.meaning,
      error_message: r.error_message,
    }));
    grouped = groupApiResults(unified);
  }

  // Endpoint-level rollup (what the customer actually scans first).
  const endpoints = grouped.map((g) => {
    const failing = g.entries.filter((e) => e.status === "failed").length;
    const flaky = g.entries.filter((e) => e.status === "flaky").length;
    const status: "passed" | "failed" | "flaky" = failing > 0 ? "failed" : flaky > 0 ? "flaky" : "passed";
    return { ...g, failing, flaky, status, total: g.entries.length };
  });
  const totalChecks = endpoints.reduce((a, g) => a + g.total, 0);
  const epPass = endpoints.filter((e) => e.status === "passed").length;
  const epFail = endpoints.filter((e) => e.status === "failed").length;
  const epFlaky = endpoints.filter((e) => e.status === "flaky").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">API coverage &amp; results</h2>
        <p className="text-xs text-neutral-500">Every endpoint and its health, in one place. Verity tests each endpoint with example user journeys <em>and</em> automatic contract checks, then merges them — so you see API health, not tooling.</p>
      </div>

      {totalChecks === 0 ? (
        <div className="border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">No API results yet.</p>
          <p className="mt-1 text-xs text-neutral-400">Run your API tests, and (optionally) enable deeper contract checks in <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 underline">CI Setup</Link>.</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Endpoints", v: endpoints.length },
              { l: "Passing", v: epPass, cls: "text-emerald-600" },
              { l: "Failing", v: epFail, cls: epFail ? "text-red-600" : "" },
              { l: "Flaky", v: epFlaky, cls: epFlaky ? "text-amber-600" : "" },
            ].map((m) => (
              <div key={m.l} className="border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">{m.l}</div>
                <div className={`tnum mt-1 text-2xl font-semibold ${m.cls ?? ""}`}>{m.v}</div>
              </div>
            ))}
          </section>

          <p className="text-[11px] text-neutral-400">Commit {latest?.commit_sha?.slice(0, 7)} · {totalChecks} checks across {endpoints.length} endpoints</p>

          <div className="space-y-2">
            {endpoints.sort((a, b) => (a.status === "failed" ? -1 : 1) - (b.status === "failed" ? -1 : 1)).map((g) => (
              <details key={g.endpoint} className="group border border-neutral-200 dark:border-neutral-800" open={g.status !== "passed"}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5">
                  <span className={`text-sm ${g.status === "passed" ? "text-emerald-600" : g.status === "flaky" ? "text-amber-500" : "text-red-600"}`}>{g.status === "passed" ? "✓" : g.status === "flaky" ? "⚠" : "✗"}</span>
                  <span className="font-mono text-xs font-semibold">{g.endpoint}</span>
                  <span className="ml-auto text-[11px] text-neutral-400">{g.status === "passed" ? `${g.total} checks pass` : g.failing > 0 ? `${g.failing} failing` : `${g.flaky} flaky`}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <div className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800/60 dark:border-neutral-800">
                  {g.entries.map((e, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-2">
                      <span className={`mt-0.5 text-xs ${e.status === "passed" ? "text-emerald-600" : e.status === "flaky" ? "text-amber-500" : "text-red-600"}`}>{e.status === "passed" ? "✓" : e.status === "flaky" ? "⚠" : "✗"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm">{e.description}</span>
                          {/* method shown subtly — verified by both is highlighted as extra confidence */}
                          {e.foundBy.length > 1
                            ? <span className="text-[10px] text-emerald-600" title="Confirmed by both a user journey and a contract check">✓ double-verified</span>
                            : <span className={`text-[10px] ${METHOD_TAG[e.foundBy[0]]?.cls}`} title={METHOD_TAG[e.foundBy[0]]?.title}>{METHOD_TAG[e.foundBy[0]]?.label}</span>}
                        </div>
                        {e.error_message && e.status !== "passed" && <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">{e.error_message}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
