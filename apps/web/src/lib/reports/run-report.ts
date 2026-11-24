import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ResultDetails, RunMeta } from "@/lib/ingest";

export type Status = "passed" | "failed" | "flaky" | "skipped" | "healed";
export interface HistoryPoint { runId: string; status: Status; ms: number | null; at: string; current: boolean }
export interface ReportRow {
  id: string; key: string; name: string; file: string; location: string | null; status: Status;
  durationMs: number; attempts: number; error: string | null; details: ResultDetails | null;
  explanation: string | null; healed: string | null; plan: string[];
  history: HistoryPoint[]; flakeRate: number | null; failingSince: { runs: number; commit: string | null; at: string } | null;
  medianMs: number | null; change: "new-failure" | "fixed" | "newly-flaky" | "slower" | null;
}
export interface Cluster { signature: string; sample: string; ids: string[] }
export interface RunReportData {
  run: { id: string; tier: string; trigger: string; branch: string | null; commit: string | null; pr: number | null; createdAt: string; total: number; passed: number; failed: number; flaky: number; skipped: number; durationMs: number | null; meta: RunMeta | null };
  previous: { id: string; at: string; commit: string | null } | null;
  rows: ReportRow[];
  fixed: { key: string; name: string; file: string }[];
  clusters: Cluster[];
}

const keyOf = (spec: string | null, name: string | null) => `${spec ?? ""}::${name ?? ""}`;
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
/** Same error, different data: strip numbers, quoted values and ids so one root cause groups together. */
export function errorSignature(msg: string | null): string | null {
  if (!msg) return null;
  return msg.split("\n")[0]
    .replace(/(["'`])(?:(?!\1).)*\1/g, "…")
    .replace(/\b[0-9a-f]{8,}\b/gi, "…")
    .replace(/\d+(\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export async function buildRunReport(
  supabase: SupabaseClient<Database>,
  projectId: string,
  runId: string,
  explain: (msg: string | null) => string | null,
): Promise<RunReportData | null> {
  const { data: run } = await supabase.from("test_runs").select("*").eq("id", runId).eq("project_id", projectId).maybeSingle();
  if (!run) return null;

  const [{ data: results }, { data: heals }, { data: prev }] = await Promise.all([
    supabase.from("test_results").select("id, status, error_message, duration_ms, attempts, test_id, name, spec_path, location, details").eq("run_id", runId).limit(5000),
    supabase.from("healing_events").select("test_id, new_selector").eq("run_id", runId).eq("status", "applied"),
    supabase.from("test_runs").select("id, created_at, commit_sha").eq("project_id", projectId).eq("discipline", run.discipline).eq("status", "completed")
      .eq("branch", run.branch ?? "").lt("created_at", run.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const res = results ?? [];

  const testIds = [...new Set(res.map((r) => r.test_id).filter(Boolean))] as string[];
  const specs = [...new Set(res.map((r) => r.spec_path).filter(Boolean))] as string[];
  const [{ data: tests }, { data: hist }, { data: prevRes }] = await Promise.all([
    testIds.length ? supabase.from("tests").select("id, name, plan").in("id", testIds) : Promise.resolve({ data: [] as { id: string; name: string; plan: unknown }[] }),
    specs.length ? supabase.from("test_results").select("run_id, spec_path, name, status, duration_ms, created_at").eq("project_id", projectId).in("spec_path", specs.slice(0, 300))
      .lte("created_at", run.completed_at ?? new Date().toISOString()).order("created_at", { ascending: false }).limit(8000) : Promise.resolve({ data: [] as never[] }),
    prev ? supabase.from("test_results").select("spec_path, name, status, duration_ms").eq("run_id", prev.id).limit(5000) : Promise.resolve({ data: [] as never[] }),
  ]);
  const testById = new Map((tests ?? []).map((t) => [t.id, t]));
  const healedBy = new Map((heals ?? []).map((h) => [h.test_id, h.new_selector]));

  // History per test (newest first), capped at 20 points, current run included.
  const byKey = new Map<string, { run_id: string; status: string; duration_ms: number | null; created_at: string }[]>();
  for (const h of hist ?? []) {
    const k = keyOf(h.spec_path, h.name);
    const arr = byKey.get(k) ?? [];
    if (arr.length < 20 && !arr.some((x) => x.run_id === h.run_id)) arr.push(h);
    byKey.set(k, arr);
  }
  const runIds = [...new Set([...byKey.values()].flat().map((h) => h.run_id))];
  const { data: runRows } = runIds.length ? await supabase.from("test_runs").select("id, commit_sha").in("id", runIds.slice(0, 1000)) : { data: [] };
  const commitOf = new Map((runRows ?? []).map((r) => [r.id, r.commit_sha]));

  const prevBy = new Map((prevRes ?? []).map((p) => [keyOf(p.spec_path, p.name), p]));
  const baseName = (p: string | null) => (p ? p.split("/").pop()!.replace(/\.spec\.(t|j)s$/, "").replace(/[-_]/g, " ") : "");

  const rows: ReportRow[] = res.map((r) => {
    const k = keyOf(r.spec_path, r.name);
    const t = r.test_id ? testById.get(r.test_id) : null;
    const h = (byKey.get(k) ?? []).slice();
    if (!h.some((x) => x.run_id === runId)) h.unshift({ run_id: runId, status: r.status, duration_ms: r.duration_ms, created_at: run.created_at });
    const history: HistoryPoint[] = h.slice(0, 20).reverse().map((x) => ({ runId: x.run_id, status: x.status as Status, ms: x.duration_ms, at: x.created_at, current: x.run_id === runId }));
    const flakeRate = history.length >= 2 ? history.filter((x) => x.status === "flaky").length / history.length : null;
    // Failing streak ending at this run (newest-first walk).
    let failingSince: ReportRow["failingSince"] = null;
    if (r.status === "failed") {
      let n = 0, last = h[0];
      for (const x of h) { if (x.status === "failed") { n++; last = x; } else break; }
      failingSince = { runs: n, commit: commitOf.get(last.run_id) ?? null, at: last.created_at };
    }
    const p = prevBy.get(k);
    const med = median(h.slice(1).map((x) => x.duration_ms).filter((d): d is number => typeof d === "number" && d > 0));
    let change: ReportRow["change"] = null;
    if (prev) {
      if (r.status === "failed" && (!p || p.status !== "failed")) change = "new-failure";
      else if (r.status === "flaky" && p && p.status === "passed") change = "newly-flaky";
      else if (r.status !== "failed" && med && r.duration_ms && r.duration_ms > med * 1.5 && r.duration_ms - med > 500) change = "slower";
    }
    const file = (r.location ?? r.spec_path ?? "").replace(/:\d+$/, "");
    return {
      id: r.id, key: k, name: t?.name ?? r.name ?? (baseName(r.spec_path) || "Test"), file: file || r.spec_path || "",
      location: r.location, status: r.status as Status, durationMs: r.duration_ms ?? 0, attempts: r.attempts, error: r.error_message,
      details: (r.details as ResultDetails | null) ?? null,
      explanation: r.status === "passed" ? null : explain(r.error_message),
      healed: r.test_id ? healedBy.get(r.test_id) ?? null : null,
      plan: Array.isArray(t?.plan) ? (t!.plan as unknown[]).map(String) : [],
      history, flakeRate, failingSince, medianMs: med, change,
    };
  });

  const nowKeys = new Map(rows.map((r) => [r.key, r]));
  const fixed = prev ? (prevRes ?? []).filter((p) => p.status === "failed" && nowKeys.get(keyOf(p.spec_path, p.name)) && nowKeys.get(keyOf(p.spec_path, p.name))!.status !== "failed")
    .map((p) => { const r = nowKeys.get(keyOf(p.spec_path, p.name))!; return { key: r.key, name: r.name, file: r.file }; }) : [];

  const groups = new Map<string, Cluster>();
  for (const r of rows.filter((x) => x.status === "failed")) {
    const sig = errorSignature(r.error);
    if (!sig) continue;
    const g = groups.get(sig) ?? { signature: sig, sample: r.error!.split("\n")[0], ids: [] };
    g.ids.push(r.id);
    groups.set(sig, g);
  }

  return {
    run: {
      id: run.id, tier: run.tier, trigger: run.trigger, branch: run.branch, commit: run.commit_sha, pr: run.pr_number, createdAt: run.created_at,
      total: run.total, passed: run.passed, failed: run.failed, flaky: run.flaky, skipped: run.skipped, durationMs: run.duration_ms,
      meta: (run.meta as RunMeta | null) ?? null,
    },
    previous: prev ? { id: prev.id, at: prev.created_at, commit: prev.commit_sha } : null,
    rows,
    fixed,
    clusters: [...groups.values()].filter((g) => g.ids.length >= 2).sort((a, b) => b.ids.length - a.ids.length),
  };
}
