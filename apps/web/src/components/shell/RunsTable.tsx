import Link from "next/link";
import { RunBar, RunStatus, Chip, fmtDuration, timeAgo, th, td } from "./ui";
import { createClient } from "@/lib/supabase/server";

export interface RunRow {
  id: string; project_id: string; discipline: string; tier: string; trigger: string;
  branch: string | null; commit_sha: string | null; pr_number: number | null; status: string;
  total: number; passed: number; failed: number; flaky: number; skipped?: number; duration_ms: number | null; created_at: string;
}

const AGENT: Record<string, string> = { ui: "Scout", api: "Relay", contract: "Relay", visual: "Prism", performance: "Pulse", security: "Warden", accessibility: "Lumen", agent: "Scout" };

type Summary = { text: string; tone: "ok" | "warn" | "bad" | "neutral"; label: string };

/**
 * Security scans and performance checks don't produce pass/fail tests, so a
 * "0 / 0" result is meaningless. Describe what they actually found instead.
 */
async function summarize(runs: RunRow[]): Promise<Map<string, Summary>> {
  const out = new Map<string, Summary>();
  const sec = runs.filter((r) => r.discipline === "security" && r.total === 0).map((r) => r.id);
  const perf = runs.filter((r) => r.discipline === "performance" && r.total === 0).map((r) => r.id);
  if (!sec.length && !perf.length) return out;
  const supabase = await createClient();
  const [{ data: findings }, { data: reports }] = await Promise.all([
    sec.length ? supabase.from("security_findings").select("run_id, severity").in("run_id", sec) : Promise.resolve({ data: [] as { run_id: string; severity: string }[] }),
    perf.length ? supabase.from("perf_reports").select("run_id, aggregate").in("run_id", perf) : Promise.resolve({ data: [] as { run_id: string | null; aggregate: unknown }[] }),
  ]);
  for (const id of sec) {
    const f = (findings ?? []).filter((x) => x.run_id === id);
    const worst = ["critical", "high", "medium", "low"].find((s) => f.some((x) => x.severity === s));
    const n = (s: string) => f.filter((x) => x.severity === s).length;
    out.set(id, f.length === 0
      ? { text: "No findings", tone: "ok", label: "Clean" }
      : { text: `${f.length} finding${f.length === 1 ? "" : "s"}${worst ? ` · ${n(worst)} ${worst}` : ""}`, tone: worst === "critical" || worst === "high" ? "bad" : worst === "medium" ? "warn" : "neutral", label: worst === "critical" || worst === "high" ? "Risk" : "Review" });
  }
  for (const id of perf) {
    const a = (reports ?? []).find((x) => x.run_id === id)?.aggregate as { p95?: number; errorRate?: number; requests?: number } | undefined;
    if (!a) continue;
    const err = Math.round((a.errorRate ?? 0) * 1000) / 10;
    out.set(id, { text: `p95 ${Math.round(a.p95 ?? 0)} ms · ${err}% errors · ${a.requests ?? 0} requests`, tone: err > 1 ? "bad" : "ok", label: err > 1 ? "Errors" : "Healthy" });
  }
  return out;
}

const runTitle = (r: RunRow) =>
  r.pr_number ? `PR #${r.pr_number}` : r.branch === "cloud-trial" ? "Cloud check" : r.branch === "cloud" ? "Cloud run" : r.branch ?? r.trigger;
const runSub = (r: RunRow) => {
  const cloud = r.branch === "cloud" || r.branch === "cloud-trial";
  const where = cloud ? "Run by QAShift" : r.trigger === "manual" ? "Local" : `CI · ${r.branch ?? "—"}${r.commit_sha ? ` · ${r.commit_sha.slice(0, 7)}` : ""}`;
  const what = r.discipline === "security" ? "Security scan" : r.discipline === "performance" && r.total === 0 ? "Performance check" : r.tier === "fast" ? "Quick check" : "Full regression";
  return `${where} · ${what}`;
};

export async function RunsTable({ runs, projectNames, showProject = true }: { runs: RunRow[]; projectNames?: Map<string, string>; showProject?: boolean }) {
  const summaries = await summarize(runs);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[13px]">
        <thead className="border-b border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900">
          <tr>
            <th scope="col" className={th}>Run</th>
            {showProject && <th scope="col" className={th}>Project</th>}
            <th scope="col" className={th}>Agent</th>
            <th scope="col" className={`${th} w-[220px]`}>Results</th>
            <th scope="col" className={`${th} text-right`}>Duration</th>
            <th scope="col" className={`${th} text-right`}>When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {runs.map((r) => (
            <tr key={r.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950">
              <td className={td}>
                <Link href={`/dashboard/projects/${r.project_id}/runs/${r.id}`} className="flex items-center gap-3">
                  {summaries.get(r.id) ? <Chip tone={summaries.get(r.id)!.tone === "neutral" ? "warn" : summaries.get(r.id)!.tone}>{summaries.get(r.id)!.label}</Chip> : <RunStatus status={r.status} failed={r.failed} flaky={r.flaky} />}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-900 group-hover:underline dark:text-neutral-100">
                      {runTitle(r)}
                    </span>
                    <span className="block truncate text-[11.5px] text-neutral-500">
                      {runSub(r)}
                    </span>
                  </span>
                </Link>
              </td>
              {showProject && <td className={`${td} text-neutral-600 dark:text-neutral-300`}>{projectNames?.get(r.project_id) ?? "—"}</td>}
              <td className={td}><Chip tone="neutral">{AGENT[r.discipline] ?? r.discipline}</Chip></td>
              <td className={td}>
                {summaries.get(r.id) ? (
                  <span className="text-[12.5px] text-neutral-700 dark:text-neutral-300">{summaries.get(r.id)!.text}</span>
                ) : (
                <div className="flex items-center gap-3">
                  <RunBar passed={r.passed} failed={r.failed} flaky={r.flaky} skipped={r.skipped ?? 0} className="max-w-[110px]" />
                  <span className="tnum whitespace-nowrap text-[12px] text-neutral-600 dark:text-neutral-400">
                    <span className="text-emerald-700 dark:text-emerald-400">{r.passed}</span>
                    {r.failed > 0 && <> · <span className="text-red-700 dark:text-red-400">{r.failed}</span></>}
                    {r.flaky > 0 && <> · <span className="text-amber-700 dark:text-amber-400">{r.flaky}</span></>}
                    <span className="text-neutral-400"> / {r.total}</span>
                  </span>
                </div>
                )}
              </td>
              <td className={`${td} tnum text-right text-neutral-600 dark:text-neutral-400`}>{fmtDuration(r.duration_ms)}</td>
              <td className={`${td} whitespace-nowrap text-right text-neutral-500`}>{timeAgo(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const RUN_COLUMNS = "id, project_id, discipline, tier, trigger, branch, commit_sha, pr_number, status, total, passed, failed, flaky, skipped, duration_ms, created_at";
