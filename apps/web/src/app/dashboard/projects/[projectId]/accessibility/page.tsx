import Link from "next/link";
import { projectTokens } from "@/lib/tokens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chip, Empty, ImpactChip, KpiStrip, Panel, PageHeader, MiniBars, timeAgo, th, td } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Accessibility", robots: { index: false } };

type Delta = { ruleId: string; impact: string | null; prevCount: number; currCount: number };

export default async function AccessibilityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name, repo, default_branch, a11y_fail_on, a11y_scan_urls").eq("id", projectId).maybeSingle();
  const { a11y: a11yToken } = await projectTokens(supabase, projectId);
  if (!project) notFound();

  const [{ data: scans }, { data: diffs }] = await Promise.all([
    supabase.from("a11y_scans").select("id, url, branch, commit_sha, pr_number, score, violations_count, impact_critical, impact_serious, impact_moderate, impact_minor, overlay_vendors, created_at").eq("project_id", projectId).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
    supabase.from("a11y_diffs").select("scan_id, new_count, fixed_count, worsened_count, new_rules, worsened_rules, prev_scan_id, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
  ]);

  const list = scans ?? [];
  const diffBy = new Map((diffs ?? []).map((d) => [d.scan_id, d]));
  const latestByUrl = new Map<string, (typeof list)[number]>();
  for (const s of list) if (!latestByUrl.has(s.url)) latestByUrl.set(s.url, s);
  const pages = [...latestByUrl.values()];
  const latest = list[0];
  const latestDiff = latest ? diffBy.get(latest.id) : undefined;
  const avg = pages.length ? pages.reduce((n, s) => n + Number(s.score ?? 0), 0) / pages.length : null;
  const serious = pages.reduce((n, s) => n + s.impact_critical + s.impact_serious, 0);
  const trend = [...list].slice(0, 30).reverse();
  const newRules = ((latestDiff?.new_rules ?? []) as Delta[]).concat((latestDiff?.worsened_rules ?? []) as Delta[]);

  return (
    <>
      <PageHeader
        title="Accessibility"
        crumbs={[{ href: "/dashboard/projects", label: "Projects" }, { href: `/dashboard/projects/${projectId}`, label: project.name }]}
        lead={<>Lumen scans each deploy against WCAG 2.2 A/AA rules and compares it with the previous deploy of the same page and branch. Gate: <span className="font-medium text-neutral-800 dark:text-neutral-200">{project.a11y_fail_on === "off" ? "report only" : project.a11y_fail_on === "new" ? "fail on new issues" : "fail on new or worsened issues"}</span>.</>}
      />

      {list.length === 0 ? (
        <>
          <Empty title="No accessibility scans yet" body="Add the step below to your pipeline. Each deploy is scanned and compared with the previous deploy of the same page." />
          <ConnectLumen token={a11yToken} urls={project.a11y_scan_urls} />
        </>
      ) : (
        <>
          <KpiStrip items={[
            { label: "Average score", value: avg === null ? "—" : `${Math.round(avg)}`, sub: `${pages.length} page${pages.length === 1 ? "" : "s"} monitored`, tone: avg !== null && avg >= 90 ? "ok" : "warn" },
            { label: "Critical + serious", value: String(serious), tone: serious ? "bad" : "ok", sub: "on latest scans" },
            { label: "New since last deploy", value: String((latestDiff?.new_count ?? 0) + (latestDiff?.worsened_count ?? 0)), tone: (latestDiff?.new_count ?? 0) + (latestDiff?.worsened_count ?? 0) ? "bad" : "ok", sub: latestDiff?.prev_scan_id ? `${latestDiff.fixed_count} fixed` : "baseline" },
            { label: "Last scan", value: latest ? timeAgo(latest.created_at) : "—", sub: latest?.branch ?? undefined },
          ]} />

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel title="Pages" flush>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[13px]">
                  <thead className="border-b border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900">
                    <tr><th className={th}>Page</th><th className={`${th} text-right`}>Score</th><th className={th}>By impact</th><th className={th}>Change</th><th className={`${th} text-right`}>Scanned</th></tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {pages.map((s) => {
                      const d = diffBy.get(s.id);
                      return (
                        <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950">
                          <td className={`${td} max-w-[260px]`}><Link href={`/dashboard/projects/${projectId}/accessibility/scans/${s.id}`} className="block truncate font-medium hover:underline">{s.url.replace(/^https?:\/\//, "")}</Link></td>
                          <td className={`${td} tnum text-right font-semibold ${Number(s.score) >= 90 ? "text-emerald-700" : Number(s.score) >= 70 ? "text-amber-700" : "text-red-700"}`}>{s.score === null ? "—" : Math.round(Number(s.score))}</td>
                          <td className={td}><Impacts c={s.impact_critical} s={s.impact_serious} m={s.impact_moderate} n={s.impact_minor} /></td>
                          <td className={td}>{!d?.prev_scan_id ? <Chip tone="neutral">baseline</Chip> : d.new_count + d.worsened_count > 0 ? <Chip tone="bad">+{d.new_count + d.worsened_count} worse</Chip> : d.fixed_count ? <Chip tone="ok">{d.fixed_count} fixed</Chip> : <Chip tone="ok">no change</Chip>}</td>
                          <td className={`${td} whitespace-nowrap text-right text-neutral-500`}>{timeAgo(s.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="space-y-5">
              <Panel title="Score over recent scans">
                <MiniBars label="Accessibility score of recent scans" values={trend.map((s) => Number(s.score ?? 0))} max={100} tones={trend.map((s) => (Number(s.score) >= 90 ? "ok" : Number(s.score) >= 70 ? "warn" : "bad"))} height={64} />
              </Panel>
              <Panel title="What got worse in the last deploy" flush>
                {newRules.length === 0 ? <p className="p-4 text-[13px] text-neutral-500">{latestDiff?.prev_scan_id ? "Nothing new or worse." : "The first scan sets the baseline."}</p> : (
                  <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {newRules.slice(0, 10).map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]">
                        <span className="truncate font-mono">{r.ruleId}</span>
                        <span className="flex shrink-0 items-center gap-2"><ImpactChip impact={r.impact} /><span className="tnum text-[12px] text-neutral-500">{r.prevCount}→{r.currCount}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              {latest?.overlay_vendors?.length ? (
                <Panel title="Overlay script detected"><p className="text-[13px] text-neutral-600">{latest.overlay_vendors.join(", ")}. Overlays mask issues rather than fix them; Lumen reports the underlying problems.</p></Panel>
              ) : null}
            </div>
          </div>

          <ConnectLumen token={a11yToken} urls={project.a11y_scan_urls} collapsed />
          <Panel className="mt-5" title="Scan history" flush>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {list.slice(0, 20).map((s) => (
                <li key={s.id}>
                  <Link href={`/dashboard/projects/${projectId}/accessibility/scans/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] hover:bg-neutral-50 dark:hover:bg-neutral-950">
                    <span className="min-w-0"><span className="block truncate">{s.url.replace(/^https?:\/\//, "")}</span><span className="block font-mono text-[11.5px] text-neutral-500">{s.branch ?? "—"}{s.commit_sha ? ` · ${s.commit_sha.slice(0, 7)}` : ""}{s.pr_number ? ` · PR #${s.pr_number}` : ""}</span></span>
                    <span className="flex shrink-0 items-center gap-3"><span className="tnum font-medium">{s.score === null ? "—" : Math.round(Number(s.score))}</span><span className="w-16 text-right text-neutral-500">{timeAgo(s.created_at)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </>
  );
}

function Impacts({ c, s, m, n }: { c: number; s: number; m: number; n: number }) {
  const cell = (v: number, cls: string, l: string) => <span title={`${v} ${l}`} className={`tnum inline-flex h-5 min-w-[26px] items-center justify-center rounded px-1 text-[11.5px] font-medium ${v ? cls : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"}`}>{v}</span>;
  return <span className="flex gap-1">{cell(c, "bg-red-600 text-white", "critical")}{cell(s, "bg-red-100 text-red-800", "serious")}{cell(m, "bg-amber-100 text-amber-900", "moderate")}{cell(n, "bg-neutral-200 text-neutral-700", "minor")}</span>;
}

function ConnectLumen({ token, urls, collapsed }: { token: string | null; urls: string[]; collapsed?: boolean }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qashifthq.com";
  const yaml = `# .github/workflows/accessibility.yml
name: Accessibility
on: [pull_request, push]
jobs:
  lumen:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Start your app or point at a deployed preview, then:
      - uses: qashift/qashift-a11y-action@v1
        with:
          urls: ${urls.length ? urls.join(",") : "https://staging.example.com,https://staging.example.com/checkout"}
          token: \${{ secrets.QASHIFT_A11Y_TOKEN }}
          api-url: ${appUrl}`;
  const body = (
    <div className="space-y-3 text-[13px]">
      <p className="text-neutral-600 dark:text-neutral-400">1. Add this project&apos;s accessibility token as a repository secret named <code className="rounded bg-neutral-100 px-1 font-mono text-[12px] dark:bg-neutral-800">QASHIFT_A11Y_TOKEN</code>.</p>
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[12px] dark:border-neutral-800 dark:bg-neutral-950"><span className="select-all truncate">{token ?? "—"}</span></div>
      <p className="text-neutral-600 dark:text-neutral-400">2. Add the step to your workflow. Pipelines that already run the accessibility action only need the <code className="font-mono text-[12px]">api-url</code> line.</p>
      <pre className="overflow-x-auto rounded-md bg-neutral-950 p-3 font-mono text-[12px] leading-relaxed text-neutral-200">{yaml}</pre>
    </div>
  );
  return collapsed ? (
    <details className="mt-5 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-semibold">Connect Lumen in CI</summary>
      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">{body}</div>
    </details>
  ) : <Panel className="mt-5" title="Connect Lumen in CI">{body}</Panel>;
}
