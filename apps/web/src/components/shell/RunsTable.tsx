import Link from "next/link";
import { RunBar, RunStatus, Chip, fmtDuration, timeAgo, th, td } from "./ui";

export interface RunRow {
  id: string; project_id: string; discipline: string; tier: string; trigger: string;
  branch: string | null; commit_sha: string | null; pr_number: number | null; status: string;
  total: number; passed: number; failed: number; flaky: number; skipped?: number; duration_ms: number | null; created_at: string;
}

const AGENT: Record<string, string> = { ui: "Scout", api: "Relay", contract: "Relay", visual: "Prism", performance: "Pulse", security: "Warden", accessibility: "Lumen", agent: "Scout" };

export function RunsTable({ runs, projectNames, showProject = true }: { runs: RunRow[]; projectNames?: Map<string, string>; showProject?: boolean }) {
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
                  <RunStatus status={r.status} failed={r.failed} flaky={r.flaky} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-900 group-hover:underline dark:text-neutral-100">
                      {r.pr_number ? `PR #${r.pr_number}` : r.branch ?? r.trigger}
                    </span>
                    <span className="block truncate font-mono text-[11.5px] text-neutral-500">
                      {r.branch ?? "—"}{r.commit_sha ? ` · ${r.commit_sha.slice(0, 7)}` : ""} · {r.tier === "fast" ? "Quick check" : "Full regression"}
                    </span>
                  </span>
                </Link>
              </td>
              {showProject && <td className={`${td} text-neutral-600 dark:text-neutral-300`}>{projectNames?.get(r.project_id) ?? "—"}</td>}
              <td className={td}><Chip tone="neutral">{AGENT[r.discipline] ?? r.discipline}</Chip></td>
              <td className={td}>
                <div className="flex items-center gap-3">
                  <RunBar passed={r.passed} failed={r.failed} flaky={r.flaky} skipped={r.skipped ?? 0} className="max-w-[110px]" />
                  <span className="tnum whitespace-nowrap text-[12px] text-neutral-600 dark:text-neutral-400">
                    <span className="text-emerald-700 dark:text-emerald-400">{r.passed}</span>
                    {r.failed > 0 && <> · <span className="text-red-700 dark:text-red-400">{r.failed}</span></>}
                    {r.flaky > 0 && <> · <span className="text-amber-700 dark:text-amber-400">{r.flaky}</span></>}
                    <span className="text-neutral-400"> / {r.total}</span>
                  </span>
                </div>
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
