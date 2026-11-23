import { createAdminClient } from "@/lib/supabase/admin";
import { diffScans, normalizeAxe, shouldFail, type FailPolicy, type NormalizedIssue } from "./index";
import { installationOctokit } from "@/lib/github/app";
import { parseRepo, resolveInstallationId } from "@/lib/github/post";
import type { Tables } from "@/lib/supabase/database.types";
import { MARKER, buildA11ySummary, type A11yPayload, type A11yPageResult, type A11yResult } from "./pure";
export * from "./pure";

/*
 * Lumen (Accessibility Agent) ingest. Accepts the same payload the former
 * standalone accessibility Action sent — { commit_sha, branch, pr_number?, pages: [{ url, axe }] } —
 * so existing pipelines only need their api-url pointed here.
 */

export async function activeLegacyA11yTier(orgId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("legacy_a11y_subscriptions").select("plan_tier, status").eq("org_id", orgId);
  const active = (data ?? []).filter((s) => s.status === "active");
  const order = ["enterprise", "scale", "growth", "starter", "free"];
  return order.find((t) => active.some((s) => s.plan_tier === t)) ?? null;
}

function rowsToIssues(rows: { rule_id: string; impact: string | null; node_count: number }[]): NormalizedIssue[] {
  return rows.map((r) => ({ ruleId: r.rule_id, impact: (r.impact ?? null) as NormalizedIssue["impact"], description: "", help: "", helpUrl: "", wcagTags: [], nodeCount: r.node_count, nodes: [] }));
}

export async function ingestA11y(project: Tables<"projects">, payload: A11yPayload): Promise<A11yResult> {
  const admin = createAdminClient();
  const policy = (project.a11y_fail_on ?? "new_or_worsened") as FailPolicy;
  const pages: A11yPageResult[] = [];
  let failed = false;

  for (const page of payload.pages) {
    const normalized = normalizeAxe(page.axe, { url: page.url });
    const s = normalized.summary;
    const { data: scan, error } = await admin.from("a11y_scans").insert({
      project_id: project.id, org_id: project.org_id, source: "ci", url: page.url,
      commit_sha: payload.commit_sha, branch: payload.branch, pr_number: payload.pr_number ?? null, status: "completed",
      score: s.score, violations_count: s.violationsCount, passes_count: s.passesCount, incomplete_count: s.incompleteCount,
      impact_critical: s.impact.critical, impact_serious: s.impact.serious, impact_moderate: s.impact.moderate, impact_minor: s.impact.minor,
      overlay_vendors: s.overlayVendors ?? [], engine: s.engine, result: { summary: s } as never,
    }).select("id").single();
    if (error || !scan) throw new Error(`failed to store scan: ${error?.message}`);

    if (normalized.issues.length) {
      await admin.from("a11y_issues").insert(normalized.issues.map((i) => ({
        scan_id: scan.id, rule_id: i.ruleId, impact: i.impact ?? null, description: i.description, help: i.help, help_url: i.helpUrl,
        wcag_tags: i.wcagTags, selector: i.nodes[0]?.selector ?? null, html: i.nodes[0]?.html ?? null, node_count: i.nodeCount,
      })));
    }

    const { data: prev } = await admin.from("a11y_scans").select("id")
      .eq("project_id", project.id).eq("branch", payload.branch).eq("url", page.url).eq("status", "completed").neq("id", scan.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    let prevIssues: NormalizedIssue[] | null = null;
    if (prev) {
      const { data: rows } = await admin.from("a11y_issues").select("rule_id, impact, node_count").eq("scan_id", prev.id);
      prevIssues = rowsToIssues(rows ?? []);
    }
    const diff = diffScans(prevIssues, normalized.issues);
    await admin.from("a11y_diffs").insert({
      project_id: project.id, branch: payload.branch, scan_id: scan.id, prev_scan_id: prev?.id ?? null,
      new_count: diff.counts.new, fixed_count: diff.counts.fixed, worsened_count: diff.counts.worsened, unchanged_count: diff.counts.unchanged,
      new_rules: diff.new as never, fixed_rules: diff.fixed as never, worsened_rules: diff.worsened as never,
    });
    if (prev && shouldFail(diff, policy)) failed = true;
    pages.push({ url: page.url, score: s.score, scanId: scan.id, diff, baseline: !prev });
  }
  return { failed, pages };
}

export async function pruneA11yScans(projectId: string, keep: number): Promise<void> {
  if (!Number.isFinite(keep) || keep <= 0 || keep > 9999) return;
  const admin = createAdminClient();
  const { data: old } = await admin.from("a11y_scans").select("id").eq("project_id", projectId)
    .order("created_at", { ascending: false }).range(keep, keep + 999);
  const ids = (old ?? []).map((r) => r.id);
  if (ids.length) await admin.from("a11y_scans").delete().in("id", ids);
}

/** Posts (or updates) one PR comment and a Check Run. Returns the check URL, or null if GitHub isn't connected. */
export async function postA11yResults(project: Tables<"projects">, payload: A11yPayload, result: A11yResult, mergeBlocking: boolean, appUrl: string): Promise<string | null> {
  const repo = parseRepo(project.repo);
  const installationId = await resolveInstallationId(project);
  if (!repo || !installationId) return null;
  const octo = await installationOctokit(installationId);
  if (!octo) return null;
  const body = buildA11ySummary(result, appUrl, project.id);
  if (payload.pr_number) {
    const { data: comments } = await octo.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", { ...repo, issue_number: payload.pr_number, per_page: 100 });
    const mine = (comments as { id: number; body?: string }[]).find((c) => c.body?.includes(MARKER));
    if (mine) await octo.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", { ...repo, comment_id: mine.id, body });
    else await octo.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", { ...repo, issue_number: payload.pr_number, body });
  }
  const conclusion = result.failed && mergeBlocking ? "failure" : "success";
  const { data: check } = await octo.request("POST /repos/{owner}/{repo}/check-runs", {
    ...repo, name: "QAShift — Accessibility", head_sha: payload.commit_sha, status: "completed", conclusion,
    output: { title: result.failed ? "Accessibility regressions found" : "No new accessibility regressions", summary: body.slice(0, 60000) },
  });
  return (check as { html_url?: string }).html_url ?? null;
}
