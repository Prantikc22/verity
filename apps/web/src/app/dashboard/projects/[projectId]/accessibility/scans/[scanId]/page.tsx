import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chip, ImpactChip, KpiStrip, Panel, PageHeader, timeAgo } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Accessibility scan", robots: { index: false } };

const ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

export default async function A11yScanPage({ params }: { params: Promise<{ projectId: string; scanId: string }> }) {
  const { projectId, scanId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: scan }, { data: issues }, { data: diff }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    supabase.from("a11y_scans").select("*").eq("id", scanId).eq("project_id", projectId).maybeSingle(),
    supabase.from("a11y_issues").select("id, rule_id, impact, help, help_url, wcag_tags, selector, html, node_count").eq("scan_id", scanId),
    supabase.from("a11y_diffs").select("new_rules, worsened_rules, fixed_rules, prev_scan_id").eq("scan_id", scanId).maybeSingle(),
  ]);
  if (!project || !scan) notFound();
  const newIds = new Set([...(diff?.new_rules as { ruleId: string }[] ?? []), ...(diff?.worsened_rules as { ruleId: string }[] ?? [])].map((r) => r.ruleId));
  const sorted = [...(issues ?? [])].sort((a, b) => (ORDER[a.impact ?? "minor"] ?? 4) - (ORDER[b.impact ?? "minor"] ?? 4));

  return (
    <>
      <PageHeader
        title={scan.url.replace(/^https?:\/\//, "")}
        crumbs={[{ href: `/dashboard/projects/${projectId}`, label: project.name }, { href: `/dashboard/projects/${projectId}/accessibility`, label: "Accessibility" }]}
        lead={<span className="font-mono text-[12px]">{scan.branch ?? "—"}{scan.commit_sha ? ` · ${scan.commit_sha.slice(0, 7)}` : ""}{scan.pr_number ? ` · PR #${scan.pr_number}` : ""} · {timeAgo(scan.created_at)} · {scan.engine ?? "axe-core"}</span>}
      />
      <KpiStrip items={[
        { label: "Score", value: scan.score === null ? "—" : String(Math.round(Number(scan.score))), tone: Number(scan.score) >= 90 ? "ok" : "warn" },
        { label: "Violations", value: String(scan.violations_count), tone: scan.violations_count ? "bad" : "ok" },
        { label: "Passed rules", value: String(scan.passes_count) },
        { label: "Needs review", value: String(scan.incomplete_count), sub: "automated rules can't decide" },
      ]} />
      <Panel className="mt-5" title={`Issues (${sorted.length})`} action={diff?.prev_scan_id ? `${newIds.size} new or worse since previous deploy` : "baseline scan"} flush>
        {sorted.length === 0 ? <p className="p-4 text-[13px] text-neutral-500">No automated violations on this page. Manual review is still needed for full WCAG conformance.</p> : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sorted.map((i) => (
              <li key={i.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ImpactChip impact={i.impact} />
                  <span className="font-mono text-[13px] font-medium">{i.rule_id}</span>
                  {newIds.has(i.rule_id) && <Chip tone="bad">new</Chip>}
                  <span className="text-[12px] text-neutral-500">{i.node_count} element{i.node_count === 1 ? "" : "s"}</span>
                  <span className="ml-auto flex flex-wrap gap-1">{(i.wcag_tags ?? []).filter((t) => /wcag\d/.test(t)).slice(0, 3).map((t) => <Chip key={t} tone="neutral">{t}</Chip>)}</span>
                </div>
                {i.help && <p className="mt-1.5 text-[13px] text-neutral-700 dark:text-neutral-300">{i.help}{i.help_url && <> · <a href={i.help_url} target="_blank" rel="noopener noreferrer" className="text-violet-700 hover:underline">How to fix</a></>}</p>}
                {i.selector && <pre className="mt-2 overflow-x-auto rounded-md bg-neutral-50 px-3 py-2 font-mono text-[11.5px] text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">{i.selector}{i.html ? `\n${i.html.slice(0, 300)}` : ""}</pre>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
