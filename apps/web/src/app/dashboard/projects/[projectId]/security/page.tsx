import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CloudTrial } from "../CloudTrial";

export const metadata: Metadata = { title: "Security", robots: { index: false } };

const SEV_ORDER = ["critical", "high", "medium", "low", "info"] as const;
const SEV_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  critical: { dot: "bg-red-600", text: "text-red-600", label: "Critical" },
  high: { dot: "bg-orange-500", text: "text-orange-500", label: "High" },
  medium: { dot: "bg-amber-500", text: "text-amber-600", label: "Medium" },
  low: { dot: "bg-neutral-400", text: "text-neutral-500", label: "Low" },
  info: { dot: "bg-neutral-300", text: "text-neutral-400", label: "Info" },
};

export default async function SecurityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  // Latest security scan run for this project, then its findings.
  const { data: latestRun } = await supabase
    .from("test_runs")
    .select("id, commit_sha, created_at")
    .eq("project_id", projectId)
    .eq("discipline", "security")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: findings } = latestRun
    ? await supabase.from("security_findings").select("*").eq("run_id", latestRun.id)
    : { data: [] as never[] };

  const all = findings ?? [];
  const counts = Object.fromEntries(SEV_ORDER.map((s) => [s, all.filter((f) => f.severity === s).length]));
  const sorted = [...all].sort((a, b) => SEV_ORDER.indexOf(a.severity as never) - SEV_ORDER.indexOf(b.severity as never));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Security</h2>
          <p className="text-xs text-neutral-500">Dynamic (running-app) + static (code) findings, ranked by severity — <strong>issues, not pass/fail tests</strong>.</p>
        </div>
        <Link href={`/dashboard/projects/${projectId}/ci`} className="shrink-0 border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30">⚙️ Turn on Security in CI →</Link>
      </div>

      <details className="border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">How to read these findings <span className="font-normal text-neutral-400">— triage guide</span></summary>
        <div className="space-y-3 border-t border-neutral-200 p-5 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <p>These are <strong>potential issues to investigate</strong>, not test failures — they never block your build. Work them top-down by severity.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-red-600">Critical / High</strong> — fix before release. Exploitable now (injection, auth bypass, secrets in code, known-vulnerable dependency).</li>
            <li><strong className="text-amber-600">Medium</strong> — schedule a fix. Real weaknesses that usually need another condition to exploit (missing security headers, weak config).</li>
            <li><strong className="text-neutral-500">Low / Info</strong> — hygiene and hardening. Batch them; don&apos;t let them drown the high ones.</li>
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="font-medium text-neutral-700 dark:text-neutral-300">Static analysis — your code</p>
              <p className="mt-1">Points at a <strong>file:line</strong>. Highly precise. Treat a High here as a real code bug to fix at the source.</p>
            </div>
            <div className="border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="font-medium text-neutral-700 dark:text-neutral-300">Dynamic analysis — your running app</p>
              <p className="mt-1">Points at a <strong>URL</strong>. The fast <em>baseline</em> scan (PRs) can be noisy — confirm before acting. The <em>full</em> scan (merge) is deeper and more reliable.</p>
            </div>
          </div>
          <p><strong>Workflow:</strong> sort by severity → open the file/URL → check the <strong>CWE</strong> link for the class of bug and the standard fix → fix at the source (SAST) or harden the endpoint/config (DAST) → re-run. A finding that disappears next scan is resolved. Use <code>×N</code> to see how widespread an issue is.</p>
        </div>
      </details>

      {!latestRun || all.length === 0 ? (
        <div className="border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">{latestRun ? "No findings in the latest scan. 🎉" : "No security scans yet."}</p>
          {!latestRun && <p className="mt-1 text-xs text-neutral-400">Enable <strong>Security</strong> in <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 underline">CI Setup</Link> — static analysis of your code + dynamic scans against staging.</p>}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SEV_ORDER.map((s) => (
              <div key={s} className="border border-neutral-200 p-3 dark:border-neutral-800">
                <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide ${SEV_STYLE[s].text}`}><span className={`h-2 w-2 rounded-full ${SEV_STYLE[s].dot}`} />{SEV_STYLE[s].label}</div>
                <div className="tnum mt-1 text-2xl font-semibold">{counts[s]}</div>
              </div>
            ))}
          </section>

          <p className="text-[11px] text-neutral-400">Scan {latestRun.commit_sha?.slice(0, 7)} · {new Date(latestRun.created_at).toLocaleString()}</p>

          <section className="divide-y divide-neutral-100 border border-neutral-200 dark:divide-neutral-800/60 dark:border-neutral-800">
            {sorted.map((f) => {
              const st = SEV_STYLE[f.severity] ?? SEV_STYLE.info;
              const where = f.file_path ? `${f.file_path}${f.line ? `:${f.line}` : ""}` : f.url ?? "";
              return (
                <div key={f.id} className="flex items-start gap-3 p-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase ${st.text}`}>{st.label}</span>
                      <span className="text-sm font-medium">{f.title}</span>
                      <span className="bg-neutral-100 px-1 py-0.5 text-[9px] font-medium uppercase text-neutral-500 dark:bg-neutral-800">{f.engine === "zap" ? "DYNAMIC" : "STATIC"}</span>
                      {f.cwe && <span className="text-[10px] text-neutral-400">{f.cwe}</span>}
                      {f.count > 1 && <span className="text-[10px] text-neutral-400">×{f.count}</span>}
                    </div>
                    {where && <code className="mt-0.5 block truncate text-[11px] text-neutral-500">{where}</code>}
                    {f.message && <p className="mt-1 line-clamp-3 text-xs text-neutral-500">{f.message}</p>}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      <section className="space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-semibold">Add a scan — two ways</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            <strong>Quick trial</strong> checks a <em>public URL</em>&apos;s security headers &amp; exposure for an instant taste.
            <strong> Set up in CI</strong> runs the full scan — static analysis of your code <em>and</em> a dynamic scan of your running app — <strong>unlimited</strong>, including internal targets. Configure it in <Link href={`/dashboard/projects/${projectId}/ci`} className="text-indigo-600 underline">CI Setup</Link>.
          </p>
        </div>
        <CloudTrial projectId={projectId} discipline="security" />
      </section>
    </div>
  );
}
