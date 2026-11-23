import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { daysAgoISO, lastNDays } from "@/components/shell/ui";

export type ReportRow = { name: string; sub: string; value: string; note: string; tone: "warn" | "bad" | "neutral" };
export interface ReportData {
  runs: number;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  medianMs: number | null;
  buckets: { key: string; label: string; passed: number; failed: number; flaky: number }[];
  maxDay: number;
  flakiest: ReportRow[];
  failing: ReportRow[];
  slowest: ReportRow[];
}

const fmt = (ms: number) => (ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

/**
 * Aggregates run health for a set of projects over the last `days`.
 * Works with the user-scoped client (RLS) or, for share links, the admin client
 * after the caller has already constrained `projectIds` to the shared scope.
 */
export async function buildReport(
  supabase: SupabaseClient<Database>,
  projectIds: string[],
  projectNames: Map<string, string>,
  days: number,
): Promise<ReportData> {
  const since = daysAgoISO(days);
  const [{ data: runs }, { data: results }, { data: flaky }] = projectIds.length
    ? await Promise.all([
        supabase.from("test_runs").select("id, total, passed, failed, flaky, duration_ms, created_at").in("project_id", projectIds).eq("status", "completed").gte("created_at", since).limit(3000),
        supabase.from("test_results").select("name, spec_path, status, duration_ms, project_id").in("project_id", projectIds).gte("created_at", since).limit(5000),
        supabase.from("flake_stats").select("test_id, project_id, flaky_total, runs_total, last_flaky_at").in("project_id", projectIds).gt("flaky_total", 0).order("flaky_total", { ascending: false }).limit(8),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const r = runs ?? [];
  const durs = r.map((x) => x.duration_ms).filter((d): d is number => !!d).sort((a, b) => a - b);
  const buckets = lastNDays(days).map((d) => ({ ...d, passed: 0, failed: 0, flaky: 0 }));
  const byDay = new Map(buckets.map((b) => [b.key, b]));
  for (const x of r) { const b = byDay.get(x.created_at.slice(0, 10)); if (b) { b.passed += x.passed; b.failed += x.failed; b.flaky += x.flaky; } }

  type Agg = { name: string; spec: string; runs: number; fails: number; dur: number[] };
  const agg = new Map<string, Agg>();
  for (const t of results ?? []) {
    const k = `${t.spec_path}::${t.name}`;
    const a: Agg = agg.get(k) ?? { name: t.name ?? t.spec_path ?? "Test", spec: t.spec_path ?? "", runs: 0, fails: 0, dur: [] };
    a.runs += 1; if (t.status === "failed") a.fails += 1; if (t.duration_ms) a.dur.push(t.duration_ms);
    agg.set(k, a);
  }
  const all = [...agg.values()];
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);

  const flakyIds = (flaky ?? []).map((f) => f.test_id);
  const { data: flakyTests } = flakyIds.length ? await supabase.from("tests").select("id, name, spec_path").in("id", flakyIds) : { data: [] };
  const tName = new Map((flakyTests ?? []).map((t) => [t.id, t]));

  return {
    runs: r.length,
    total: r.reduce((n, x) => n + x.total, 0),
    passed: r.reduce((n, x) => n + x.passed, 0),
    failed: r.reduce((n, x) => n + x.failed, 0),
    flaky: r.reduce((n, x) => n + x.flaky, 0),
    medianMs: durs.length ? durs[Math.floor(durs.length / 2)] : null,
    buckets,
    maxDay: Math.max(1, ...buckets.map((b) => b.passed + b.failed + b.flaky)),
    flakiest: (flaky ?? []).map((f) => ({ name: tName.get(f.test_id)?.name ?? "Test", sub: `${projectNames.get(f.project_id) ?? ""} · ${tName.get(f.test_id)?.spec_path ?? ""}`, value: `${Math.round((f.flaky_total / Math.max(1, f.runs_total)) * 100)}%`, note: `${f.flaky_total}/${f.runs_total} runs`, tone: "warn" as const })),
    failing: all.filter((a) => a.fails > 0).sort((a, b) => b.fails / b.runs - a.fails / a.runs).slice(0, 8)
      .map((a) => ({ name: a.name, sub: a.spec, value: `${Math.round((a.fails / a.runs) * 100)}%`, note: `${a.fails}/${a.runs} runs`, tone: "bad" as const })),
    slowest: all.filter((a) => a.dur.length).sort((a, b) => avg(b.dur) - avg(a.dur)).slice(0, 8)
      .map((a) => ({ name: a.name, sub: a.spec, value: fmt(avg(a.dur)), note: `avg of ${a.dur.length}`, tone: "neutral" as const })),
  };
}
